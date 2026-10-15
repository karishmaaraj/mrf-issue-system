/**
 * test_whatsapp_status.js — WhatsApp Delivery-Status Webhook Test Suite
 *
 * Covers:
 *   1. GET webhook verification challenge (unchanged baseline)
 *   2. Status-only payload  — sent / delivered / read — must return 200 and not be discarded
 *   3. Failed delivery payload — must log error code and message without revealing phone or tokens
 *   4. Mixed payload (statuses + messages in same entry) — both branches must execute
 *   5. Empty/malformed payload — must still return 200 (Meta retry-prevention)
 *   6. HMAC signature rejection when app-secret is configured
 *   7. Idempotency — duplicate message IDs ignored
 *   8. Multiple statuses in one payload
 *   9. Admin notification log wording — verifies "accepted by Meta" phrasing (unit-level)
 *
 * No real WhatsApp messages are sent. No .env credentials are touched.
 * Runs an isolated in-process HTTP server on port 5091.
 */

import http from 'http';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  getWhatsAppConfig,
  verifyWebhookSignature,
  formatE164
} from './whatsappService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const TEST_PORT  = 5091;
const TEST_HOST  = '127.0.0.1';

// ── Captured log lines ────────────────────────────────────────────────────────
const capturedLogs  = [];
const capturedWarns = [];
const _origLog  = console.log.bind(console);
const _origWarn = console.warn.bind(console);

function hookLogs() {
  capturedLogs.length  = 0;
  capturedWarns.length = 0;
  console.log  = (...a) => { capturedLogs.push(a.join(' '));  _origLog(...a); };
  console.warn = (...a) => { capturedWarns.push(a.join(' ')); _origWarn(...a); };
}
function restoreLogs() {
  console.log  = _origLog;
  console.warn = _origWarn;
}

// ── Payload builder (mirrors Meta Cloud API schema) ───────────────────────────
function buildMetaPayload({ statuses, messages } = {}) {
  const value = {};
  if (statuses !== undefined) value.statuses = statuses;
  if (messages !== undefined) value.messages = messages;
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'ENTRY_ID', changes: [{ value, field: 'messages' }] }]
  });
}

// ── Replicates server.js POST /api/whatsapp/webhook handler (isolated) ────────
const processedMessageIdsSet = new Set();

function createTestServer(appSecretOverride = null, isProdOverride = null) {
  return http.createServer((req, res) => {
    const urlParts = req.url.split('?')[0];

    // GET — verification challenge
    if (req.method === 'GET' && urlParts === '/api/whatsapp/webhook') {
      const parsedUrl = new URL(req.url, 'http://localhost:' + TEST_PORT);
      const mode      = parsedUrl.searchParams.get('hub.mode');
      const token     = parsedUrl.searchParams.get('hub.verify_token');
      const challenge = parsedUrl.searchParams.get('hub.challenge');
      const waConfig  = getWhatsAppConfig();
      if (mode === 'subscribe' && token === waConfig.verifyToken) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge);
      } else {
        res.writeHead(403); res.end(JSON.stringify({ error: 'Forbidden' }));
      }
      return;
    }

    // POST — event handler
    if (req.method === 'POST' && urlParts === '/api/whatsapp/webhook') {
      let rawBody = '';
      req.on('data', chunk => { rawBody += chunk.toString(); });
      req.on('end', () => {
        try {
          const sigHeader = req.headers['x-hub-signature-256'];

          // Determine secret and production flag (with optional test overrides)
          const rawSecret = appSecretOverride !== null ? appSecretOverride : (process.env.WHATSAPP_APP_SECRET || '').trim();
          const isPlaceholder = rawSecret === 'YOUR_WHATSAPP_APP_SECRET';
          const hasSecret = Boolean(rawSecret && !isPlaceholder);
          const secret = hasSecret ? rawSecret : '';
          const isProd = isProdOverride !== null ? isProdOverride : (process.env.NODE_ENV === 'production');

          // Production guard: Never silently bypass signature verification in production
          if (isProd && !hasSecret) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Webhook signature verification required in production' }));
            return;
          }

          // When a real secret is configured, strictly require and validate X-Hub-Signature-256
          if (hasSecret) {
            if (!sigHeader) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing X-Hub-Signature-256 header' }));
              return;
            }
            const ok = verifyWebhookSignature(rawBody, sigHeader, secret);
            if (!ok) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized signature' }));
              return;
            }
          }

          const payload = JSON.parse(rawBody || '{}');
          const entry   = payload.entry?.[0];
          const changes = entry?.changes?.[0];
          const value   = changes?.value;

          // Always ACK immediately
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'received' }));

          // Delivery-status events (mirrors server.js fix)
          if (value && Array.isArray(value.statuses) && value.statuses.length > 0) {
            for (const statusEntry of value.statuses) {
              const wamid   = statusEntry.id     || '(unknown)';
              const status  = statusEntry.status || '(unknown)';
              const tsEpoch = statusEntry.timestamp;

              if (status === 'failed') {
                const errCode  = statusEntry.errors?.[0]?.code    || 'N/A';
                const errMsg   = statusEntry.errors?.[0]?.message || 'No error message';
                const errTitle = statusEntry.errors?.[0]?.title   || '';
                console.warn(
                  '[WhatsApp Delivery] wamid=' + wamid + ' status=FAILED ts=' + tsEpoch +
                  ' errorCode=' + errCode + ' errorTitle="' + errTitle + '" errorMessage="' + errMsg + '"'
                );
              } else {
                console.log(
                  '[WhatsApp Delivery] wamid=' + wamid + ' status=' + status + ' ts=' + tsEpoch
                );
              }
            }
          }

          // Incoming message events
          if (!value || !Array.isArray(value.messages) || value.messages.length === 0) return;

          const message   = value.messages[0];
          const messageId = message.id;

          if (messageId && processedMessageIdsSet.has(messageId)) {
            console.log('[WhatsApp Webhook] Duplicate message ID ' + messageId + ' ignored.');
            return;
          }
          if (messageId) processedMessageIdsSet.add(messageId);
          console.log('[WhatsApp Webhook] Processing incoming message id=' + messageId);
        } catch (err) {
          console.error('[WhatsApp Webhook Handler Error]', err);
        }
      });
      return;
    }

    res.writeHead(404); res.end('Not found');
  });
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function makeRequest(options, postData = '') {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', c => { body += c.toString(); });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function hmacSha256(secret, body) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function postWebhook(server, body, extraHeaders = {}) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const options = {
    hostname: TEST_HOST,
    port:     server.address().port,
    path:     '/api/whatsapp/webhook',
    method:   'POST',
    headers:  {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
      ...extraHeaders
    }
  };
  return makeRequest(options, bodyStr);
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    _origLog('  PASS: ' + label);
    passed++;
  } else {
    _origLog('  FAIL: ' + label + (detail ? ' -- ' + detail : ''));
    failed++;
  }
}

async function runTests() {
  _origLog('\n======================================================');
  _origLog('  WhatsApp Delivery-Status Webhook Test Suite');
  _origLog('======================================================\n');

  const server = createTestServer();
  await new Promise(r => server.listen(TEST_PORT, TEST_HOST, r));
  _origLog('  Test server listening on ' + TEST_HOST + ':' + TEST_PORT + '\n');

  // 1. GET verification challenge
  _origLog('-- Test 1: GET webhook verification challenge');
  {
    const waConfig = getWhatsAppConfig();
    const opts = {
      hostname: TEST_HOST,
      port:     TEST_PORT,
      path:     '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=' + waConfig.verifyToken + '&hub.challenge=ABC123',
      method:   'GET'
    };
    const r = await makeRequest(opts);
    assert(r.statusCode === 200, 'Returns HTTP 200');
    assert(r.body === 'ABC123',  'Echoes hub.challenge');
  }

  // 2. Status-only: sent
  _origLog('\n-- Test 2: Status-only payload -- sent');
  {
    hookLogs();
    const body = buildMetaPayload({ statuses: [{ id: 'wamid.sent001', status: 'sent', timestamp: '1728000001' }] });
    const r = await postWebhook(server, body);
    restoreLogs();
    assert(r.statusCode === 200, 'Returns HTTP 200');
    assert(JSON.parse(r.body).status === 'received', 'Body contains status=received');
    assert(capturedLogs.some(l => l.includes('wamid=wamid.sent001') && l.includes('status=sent')), 'Logs wamid and status=sent');
    assert(!capturedWarns.some(l => l.includes('wamid.sent001')), 'Does not warn for non-failed status');
  }

  // 3. Status-only: delivered
  _origLog('\n-- Test 3: Status-only payload -- delivered');
  {
    hookLogs();
    const body = buildMetaPayload({ statuses: [{ id: 'wamid.del001', status: 'delivered', timestamp: '1728000002' }] });
    const r = await postWebhook(server, body);
    restoreLogs();
    assert(r.statusCode === 200, 'Returns HTTP 200');
    assert(capturedLogs.some(l => l.includes('wamid=wamid.del001') && l.includes('status=delivered')), 'Logs wamid and status=delivered');
  }

  // 4. Status-only: read
  _origLog('\n-- Test 4: Status-only payload -- read');
  {
    hookLogs();
    const body = buildMetaPayload({ statuses: [{ id: 'wamid.read001', status: 'read', timestamp: '1728000003' }] });
    const r = await postWebhook(server, body);
    restoreLogs();
    assert(r.statusCode === 200, 'Returns HTTP 200');
    assert(capturedLogs.some(l => l.includes('wamid=wamid.read001') && l.includes('status=read')), 'Logs wamid and status=read');
  }

  // 5. Failed delivery
  _origLog('\n-- Test 5: Failed delivery payload');
  {
    hookLogs();
    const body = buildMetaPayload({
      statuses: [{
        id: 'wamid.fail001', status: 'failed', timestamp: '1728000004',
        errors: [{ code: 131047, title: 'Message failed to send', message: 'Re-engagement message: blocked by Meta' }]
      }]
    });
    const r = await postWebhook(server, body);
    restoreLogs();
    assert(r.statusCode === 200, 'Returns HTTP 200');
    assert(capturedWarns.some(l => l.includes('status=FAILED') && l.includes('wamid=wamid.fail001') && l.includes('errorCode=131047')), 'Warns with wamid, status=FAILED and errorCode');
    assert(capturedWarns.some(l => l.includes('Re-engagement message')), 'Logs Meta error message text');
    assert(!capturedWarns.join('\n').includes('Bearer'), 'Does not log auth token in failure log');
  }

  // 6. Mixed payload
  _origLog('\n-- Test 6: Mixed payload -- statuses + messages both execute');
  {
    hookLogs();
    const body = buildMetaPayload({
      statuses: [{ id: 'wamid.mix001', status: 'delivered', timestamp: '1728000005' }],
      messages: [{ id: 'wamid.msgmix001', from: '919840000001', type: 'text', text: { body: 'Hello' }, timestamp: '1728000006' }]
    });
    const r = await postWebhook(server, body);
    restoreLogs();
    assert(r.statusCode === 200, 'Returns HTTP 200');
    assert(capturedLogs.some(l => l.includes('wamid=wamid.mix001') && l.includes('status=delivered')), 'Logs delivery status');
    assert(capturedLogs.some(l => l.includes('wamid.msgmix001')), 'Also processes incoming message');
  }

  // 7. Empty payload
  _origLog('\n-- Test 7: Empty payload');
  {
    const r = await postWebhook(server, '{}');
    assert(r.statusCode === 200, 'Returns HTTP 200 for empty payload');
  }

  // 8. HMAC signature verification & production guard tests
  _origLog('\n-- Test 8: HMAC signature verification, missing header, placeholder, and production guard');
  {
    const testSecret = 'TEST_SECRET_FOR_TESTS_ONLY';
    const securedServer = createTestServer(testSecret, false);
    await new Promise(r => securedServer.listen(0, TEST_HOST, r));
    const body = buildMetaPayload({ statuses: [{ id: 'x', status: 'sent', timestamp: '0' }] });

    // 8a: Missing header when secret configured -> HTTP 401
    const rMissing = await postWebhook(securedServer, body);
    assert(rMissing.statusCode === 401, 'Rejects missing signature header when secret is configured (HTTP 401)');

    // 8b: Invalid signature -> HTTP 401
    const rBad = await postWebhook(securedServer, body, { 'x-hub-signature-256': 'sha256=badhash' });
    assert(rBad.statusCode === 401, 'Rejects invalid/tampered signature header (HTTP 401)');

    // 8c: Valid signature -> HTTP 200
    const goodSig = hmacSha256(testSecret, body);
    const rGood = await postWebhook(securedServer, body, { 'x-hub-signature-256': goodSig });
    assert(rGood.statusCode === 200, 'Accepts valid HMAC signature header (HTTP 200)');

    await new Promise(r => securedServer.close(r));

    // 8d: Placeholder secret behavior in non-production
    const placeholderServer = createTestServer('YOUR_WHATSAPP_APP_SECRET', false);
    await new Promise(r => placeholderServer.listen(0, TEST_HOST, r));
    const rPlaceholder = await postWebhook(placeholderServer, body);
    assert(rPlaceholder.statusCode === 200, 'Placeholder secret is not treated as active key in development (HTTP 200)');
    await new Promise(r => placeholderServer.close(r));

    // 8e: Production guard without secret -> HTTP 401
    const prodNoSecretServer = createTestServer('', true);
    await new Promise(r => prodNoSecretServer.listen(0, TEST_HOST, r));
    const rProdNoSecret = await postWebhook(prodNoSecretServer, body);
    assert(rProdNoSecret.statusCode === 401, 'Production guard rejects unconfigured secret (HTTP 401)');
    await new Promise(r => prodNoSecretServer.close(r));

    // 8f: Production guard with placeholder secret -> HTTP 401
    const prodPlaceholderServer = createTestServer('YOUR_WHATSAPP_APP_SECRET', true);
    await new Promise(r => prodPlaceholderServer.listen(0, TEST_HOST, r));
    const rProdPlaceholder = await postWebhook(prodPlaceholderServer, body);
    assert(rProdPlaceholder.statusCode === 401, 'Production guard rejects placeholder secret (HTTP 401)');
    await new Promise(r => prodPlaceholderServer.close(r));

    // 8g: Production guard with real secret and valid signature -> HTTP 200
    const prodSecuredServer = createTestServer(testSecret, true);
    await new Promise(r => prodSecuredServer.listen(0, TEST_HOST, r));
    const rProdValid = await postWebhook(prodSecuredServer, body, { 'x-hub-signature-256': goodSig });
    assert(rProdValid.statusCode === 200, 'Production accepts valid signature with real secret (HTTP 200)');
    await new Promise(r => prodSecuredServer.close(r));
  }

  // 9. Idempotency
  _origLog('\n-- Test 9: Duplicate message ID is ignored');
  {
    const dupId = 'wamid.dup' + Date.now();
    const body = buildMetaPayload({
      messages: [{ id: dupId, from: '919840000002', type: 'text', text: { body: 'Dup test' }, timestamp: '1728000010' }]
    });
    await postWebhook(server, body);
    hookLogs();
    await postWebhook(server, body);
    restoreLogs();
    assert(capturedLogs.some(l => l.includes('Duplicate') && l.includes(dupId)), 'Logs duplicate and ignores it');
  }

  // 10. Multiple statuses in one payload
  _origLog('\n-- Test 10: Multiple statuses in a single payload');
  {
    hookLogs();
    const body = buildMetaPayload({
      statuses: [
        { id: 'wamid.multi001', status: 'sent',      timestamp: '1728000020' },
        { id: 'wamid.multi002', status: 'delivered',  timestamp: '1728000021' },
        { id: 'wamid.multi003', status: 'read',        timestamp: '1728000022' }
      ]
    });
    const r = await postWebhook(server, body);
    restoreLogs();
    assert(r.statusCode === 200, 'Returns HTTP 200');
    assert(capturedLogs.some(l => l.includes('wamid.multi001') && l.includes('status=sent')),      'Logs first entry (sent)');
    assert(capturedLogs.some(l => l.includes('wamid.multi002') && l.includes('status=delivered')), 'Logs second entry (delivered)');
    assert(capturedLogs.some(l => l.includes('wamid.multi003') && l.includes('status=read')),      'Logs third entry (read)');
  }

  // 11. Admin notification log wording (source-level check)
  _origLog('\n-- Test 11: sendAdminWhatsAppNotification uses "accepted by Meta" wording');
  {
    const src = readFileSync(join(__dirname, 'whatsappService.js'), 'utf8');
    assert(src.includes('accepted by Meta'), 'whatsappService.js contains "accepted by Meta"');
    assert(!src.includes("result.simulated ? 'Simulated' : 'Delivered'"), 'Old "Delivered" wording is removed');
  }

  // Teardown
  await new Promise(r => server.close(r));

  _origLog('\n======================================================');
  _origLog('  Results: ' + passed + ' passed, ' + failed + ' failed out of ' + (passed + failed) + ' assertions');
  _origLog('======================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  _origLog('\nUnhandled error in test runner: ' + err);
  process.exit(1);
});
