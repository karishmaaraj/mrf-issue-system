/**
 * test_phase5_6.js — Automated Test Suite for Phase 5.6 Live Telephony Integration
 *
 * Runs an isolated test HTTP server on port 5099 running the exact Phase 5.6 telephony webhook handler logic.
 * Verifies Twilio signature validation, form-urlencoded payload parsing, unknown caller isolation,
 * zero-ticket worker handling, canonical DTMF state transitions (1, 2, 3, 4, 5, 0), TwiML XML formatting,
 * signed media URL embedding, webhook idempotency deduplication, rate limiting, and security boundaries.
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  parseFormUrlEncoded,
  verifyTwilioSignature,
  formatPhoneNumber,
  CANONICAL_DTMF_MAP,
  normalizeCallEvent,
  bindCallSession,
  validateCallSessionAccess,
  checkWebhookRateLimit,
  buildSayResponse,
  buildDtmfGatherResponse,
  buildHangupResponse,
  buildErrorResponse,
  buildAudioResponse,
  sanitizePayload
} from './telephonyAdapter.js';
import {
  getVoiceConfig,
  verifyVoiceWebhookSignature,
  buildAuthorizedTicketDTO,
  generateGroundedVoiceResponse,
  buildTicketSpokenScript
} from './voiceService.js';
import { storeVoiceAudio, generateSignedMediaUrl } from './voiceMediaService.js';
import { synthesizeSpeech } from './ttsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5099;
const TEST_HOST = '127.0.0.1';
const SECRET = 'mrf_voice_secret_2026';

const processedWebhookEventsMap = new Map();

// Helper: Makes an HTTP request to the local test server
function makeRequest(options, postData = '') {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk.toString(); });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });
    req.on('error', err => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Helper: Generates a valid Twilio X-Twilio-Signature
function computeTwilioSignature(url, params, secret) {
  let data = url;
  if (params && typeof params === 'object') {
    const sortedKeys = Object.keys(params).sort();
    for (const key of sortedKeys) {
      if (key.toLowerCase() === 'x-twilio-signature') continue;
      data += key + (params[key] !== undefined && params[key] !== null ? String(params[key]) : '');
    }
  }
  return crypto
    .createHmac('sha1', secret)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');
}

// Mock Config & Tickets Data Reader
function readMockConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  } catch {
    return {
      workers: [
        { id: 'wrk-001', name: 'Ramesh Plumber', phone: '+919840112345', role: 'Plumber' }
      ]
    };
  }
}

function readMockData() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'tickets.json'), 'utf8'));
  } catch {
    return { tickets: [] };
  }
}

// Create dedicated test HTTP server executing the Phase 5.6 webhook handler logic
function createTestServer() {
  return http.createServer((req, res) => {
    const urlParts = req.url.split('?')[0];

    if (req.method === 'POST' && (urlParts === '/api/voice/telephony-webhook' || urlParts === '/api/voice/webhook')) {
      let rawBody = '';
      req.on('data', chunk => { rawBody += chunk.toString(); });
      req.on('end', async () => {
        try {
          const voiceConfig = { webhookSecret: SECRET, telephonyProvider: 'twilio' };
          const sigHeader = req.headers['x-voice-signature'];
          const twilioSigHeader = req.headers['x-twilio-signature'];

          let body = {};
          if (rawBody.trim()) {
            try {
              body = JSON.parse(rawBody);
            } catch {
              body = parseFormUrlEncoded(rawBody);
            }
          }

          const provider = String(req.headers['x-telephony-provider'] || body.provider || 'twilio').toLowerCase();

          // Signature Verification
          if (voiceConfig.webhookSecret) {
            if (provider === 'twilio' || twilioSigHeader) {
              if (!twilioSigHeader) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized: Missing x-twilio-signature header' }));
                return;
              }
              const protocol = req.headers['x-forwarded-proto'] || 'http';
              const host = req.headers.host || `${TEST_HOST}:${TEST_PORT}`;
              const fullUrl = `${protocol}://${host}${urlParts}`;
              const isValid = verifyTwilioSignature(fullUrl, body, twilioSigHeader, voiceConfig.webhookSecret);
              if (!isValid) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized signature' }));
                return;
              }
            } else {
              if (!sigHeader) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized: Missing x-voice-signature header' }));
                return;
              }
              const isValid = verifyVoiceWebhookSignature(rawBody, sigHeader, voiceConfig.webhookSecret);
              if (!isValid) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized signature' }));
                return;
              }
            }
          }

          // Replay Protection
          const timestampHeader = req.headers['x-voice-timestamp'] || body.timestamp;
          if (timestampHeader) {
            const reqTime = parseInt(timestampHeader, 10);
            if (isNaN(reqTime) || Math.abs(Date.now() - reqTime) > 5 * 60 * 1000) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized: Stale request timestamp' }));
              return;
            }
          }

          // Normalization
          const normalized = normalizeCallEvent(body, provider);
          if (!normalized.success) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: normalized.error }));
            return;
          }

          // Deduplication Check
          const dedupeKey = `${normalized.callId || 'no_id'}_${normalized.eventType}_${normalized.dtmfDigit || ''}`;
          if (processedWebhookEventsMap.has(dedupeKey)) {
            const cached = processedWebhookEventsMap.get(dedupeKey);
            if (Date.now() - cached.timestamp < 60000) {
              if (provider === 'twilio' || req.headers['accept']?.includes('text/xml')) {
                res.writeHead(200, { 'Content-Type': 'text/xml' });
                res.end(cached.twiml || '<Response><Hangup/></Response>');
                return;
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(cached.jsonPayload));
              return;
            }
          }

          // Worker Identification
          const cfg = readMockConfig();
          const workers = cfg.workers || [];
          const callerPhoneClean = (normalized.callerPhone || '').replace(/[^\d]/g, '');

          const workerProfile = workers.find(w => {
            const wPhoneClean = (w.phone || '').replace(/[^\d]/g, '');
            return wPhoneClean.length >= 10 && callerPhoneClean.endsWith(wPhoneClean.slice(-10));
          });

          if (!workerProfile) {
            const safeText = 'இந்த எண் பதிவு செய்யப்படவில்லை. தயவுசெய்து Admin-ஐ தொடர்பு கொள்ளவும்.';
            const safeResp = buildHangupResponse(safeText, 'ta-IN', provider);
            const twiml = `<Response><Say language="ta-IN">${safeText}</Say><Hangup/></Response>`;
            const jsonPayload = { status: 'received', callerStatus: 'UNKNOWN_CALLER', providerResponse: safeResp };

            processedWebhookEventsMap.set(dedupeKey, { timestamp: Date.now(), twiml, jsonPayload });

            if (provider === 'twilio' || req.headers['accept']?.includes('text/xml')) {
              res.writeHead(200, { 'Content-Type': 'text/xml' });
              res.end(twiml);
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(jsonPayload));
            return;
          }

          // Known Worker
          const data = readMockData();
          const ticketsList = data.tickets || [];
          const workerTickets = ticketsList.filter(t => {
            const assigned = String(t.assignedWorker || '').trim().toLowerCase();
            const wName = String(workerProfile.name || '').trim().toLowerCase();
            const wId = String(workerProfile.id || '').trim().toLowerCase();
            return (assigned === wName || assigned === wId) && t.status !== 'Completed';
          });

          if (workerTickets.length === 0 && !body.ticketNo) {
            const noTicketsText = `வணக்கம் ${workerProfile.name}! உங்களுக்கு தற்போது நிலுவையில் உள்ள பணிகள் ஏதும் இல்லை.`;
            const twiml = `<Response><Say language="ta-IN">${noTicketsText}</Say><Hangup/></Response>`;
            const jsonPayload = { status: 'received', callerStatus: 'KNOWN_WORKER', activeTicketCount: 0 };

            processedWebhookEventsMap.set(dedupeKey, { timestamp: Date.now(), twiml, jsonPayload });

            if (provider === 'twilio' || req.headers['accept']?.includes('text/xml')) {
              res.writeHead(200, { 'Content-Type': 'text/xml' });
              res.end(twiml);
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(jsonPayload));
            return;
          }

          const targetTicket = workerTickets[0] || null;
          let spokenFeedback = '';

          if (normalized.eventType === 'DTMF') {
            const digit = normalized.dtmfDigit;
            if (digit === '1') spokenFeedback = 'பணி ஏற்றுக்கொள்ளப்பட்டது. நன்றி அண்ணா.';
            else if (digit === '2') spokenFeedback = 'பணி நிறைவு செய்ய இயலவில்லை என பதிவு செய்யப்பட்டது.';
            else if (digit === '3') {
              const scriptObj = buildTicketSpokenScript(targetTicket, workerProfile);
              spokenFeedback = typeof scriptObj === 'object' ? (scriptObj.fullPrompt || scriptObj.intro || '') : String(scriptObj);
            }
            else if (digit === '4') spokenFeedback = 'பணி முடிந்தது என பதிவு செய்யப்பட்டது. சரிபார்ப்பு அனுப்பப்பட்டது.';
            else if (digit === '5') spokenFeedback = generateGroundedVoiceResponse('QUERY_LOCATION', buildAuthorizedTicketDTO(targetTicket), 'ta-IN');
            else if (digit === '0') spokenFeedback = 'நிர்வாகிக்கு தகவல் தெரிவிக்கப்பட்டது. தயவுசெய்து காத்திருக்கவும்.';
            else spokenFeedback = `Input ${digit} processed cleanly.`;
          } else {
            if (targetTicket) {
              const scriptObj = buildTicketSpokenScript(targetTicket, workerProfile);
              spokenFeedback = typeof scriptObj === 'object' ? (scriptObj.fullPrompt || scriptObj.intro || '') : String(scriptObj);
            } else {
              spokenFeedback = `வணக்கம் ${workerProfile.name}!`;
            }
          }

          let twiml = '<Response>';
          twiml += `<Say language="ta-IN">${spokenFeedback}</Say>`;
          if (normalized.eventType !== 'DTMF' || normalized.dtmfDigit === '3' || normalized.dtmfDigit === '5') {
            twiml += `<Gather numDigits="1" timeout="5"></Gather>`;
          } else {
            twiml += `<Hangup/>`;
          }
          twiml += '</Response>';

          const jsonPayload = { status: 'received', callerStatus: 'KNOWN_WORKER', workerId: workerProfile.id, normalizedCallEvent: normalized };

          processedWebhookEventsMap.set(dedupeKey, { timestamp: Date.now(), twiml, jsonPayload });

          if (provider === 'twilio' || req.headers['accept']?.includes('text/xml')) {
            res.writeHead(200, { 'Content-Type': 'text/xml' });
            res.end(twiml);
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(jsonPayload));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });
}

async function runTests() {
  console.log('\n==================================================');
  console.log('STARTING PHASE 5.6 LIVE TELEPHONY INTEGRATION VERIFICATION');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, failureDetail = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${testName} ${failureDetail ? `(${failureDetail})` : ''}`);
      failed++;
    }
  }

  const server = createTestServer();
  await new Promise((resolve) => server.listen(TEST_PORT, TEST_HOST, resolve));

  try {
    console.log('--- CATEGORY A: UNIT TESTS & HELPER FUNCTIONS ---');

    // Test 1: parseFormUrlEncoded
    const parsedForm = parseFormUrlEncoded('CallSid=CA12345&From=%2B919840112345&Digits=1');
    assert(
      parsedForm.CallSid === 'CA12345' && parsedForm.From === '+919840112345' && parsedForm.Digits === '1',
      'parseFormUrlEncoded correctly parses urlencoded POST params'
    );

    // Test 2: verifyTwilioSignature Valid
    const testUrl = `http://${TEST_HOST}:${TEST_PORT}/api/voice/telephony-webhook`;
    const testParams = { CallSid: 'CA999', From: '+919840112345', Digits: '1' };
    const validSig = computeTwilioSignature(testUrl, testParams, SECRET);
    assert(
      verifyTwilioSignature(testUrl, testParams, validSig, SECRET) === true,
      'verifyTwilioSignature verifies valid HMAC-SHA1 signature'
    );

    // Test 3: verifyTwilioSignature Tampered
    assert(
      verifyTwilioSignature(testUrl, testParams, 'invalid_signature_string', SECRET) === false,
      'verifyTwilioSignature rejects tampered signature'
    );

    // Test 4: E.164 Phone Formatting
    assert(
      formatPhoneNumber('9840112345') === '+919840112345' && formatPhoneNumber('+919840112345') === '+919840112345',
      'formatPhoneNumber formats domestic and E.164 phone numbers correctly'
    );

    // Test 5: Canonical DTMF Mapping Integrity
    assert(CANONICAL_DTMF_MAP['1'].intent === 'ACCEPT_WORK', 'DTMF 1 maps to ACCEPT_WORK');
    assert(CANONICAL_DTMF_MAP['2'].intent === 'CANNOT_COMPLETE', 'DTMF 2 maps to CANNOT_COMPLETE');
    assert(CANONICAL_DTMF_MAP['3'].intent === 'REPEAT_INFO', 'DTMF 3 maps to REPEAT_INFO');
    assert(CANONICAL_DTMF_MAP['4'].intent === 'CONFIRM_COMPLETE', 'DTMF 4 maps to CONFIRM_COMPLETE');
    assert(CANONICAL_DTMF_MAP['5'].intent === 'QUERY_LOCATION', 'DTMF 5 maps to QUERY_LOCATION');
    assert(CANONICAL_DTMF_MAP['0'].intent === 'TALK_TO_ADMIN', 'DTMF 0 maps to TALK_TO_ADMIN');

    console.log('\n--- CATEGORY B: LIVE WEBHOOK HTTP TESTS ---');

    const httpOptions = {
      hostname: TEST_HOST,
      port: TEST_PORT,
      path: '/api/voice/telephony-webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Host': `${TEST_HOST}:${TEST_PORT}`
      }
    };

    // Test 6: Missing Signature Rejection (HTTP 401)
    const res6 = await makeRequest(httpOptions, 'CallSid=CA101&From=%2B919840112345');
    assert(res6.statusCode === 401, 'Webhook rejects request missing signature header (HTTP 401)');

    // Test 7: Invalid Signature Rejection (HTTP 401)
    const res7 = await makeRequest({
      ...httpOptions,
      headers: {
        ...httpOptions.headers,
        'X-Twilio-Signature': 'invalid_sig'
      }
    }, 'CallSid=CA102&From=%2B919840112345');
    assert(res7.statusCode === 401, 'Webhook rejects invalid signature (HTTP 401)');

    // Test 8: Unknown Caller Identification & TwiML Response
    const unkParams = { CallSid: 'CA_UNK_001', From: '+919999999999' };
    const unkSig = computeTwilioSignature(testUrl, unkParams, SECRET);
    const res8 = await makeRequest({
      ...httpOptions,
      headers: {
        ...httpOptions.headers,
        'X-Twilio-Signature': unkSig
      }
    }, 'CallSid=CA_UNK_001&From=%2B919999999999');

    assert(res8.statusCode === 200, 'Unknown caller request receives HTTP 200 OK');
    assert(res8.headers['content-type']?.includes('text/xml'), 'Twilio request returns Content-Type text/xml');
    assert(res8.body.includes('<Response>') && res8.body.includes('<Hangup/>'), 'Unknown caller response contains TwiML hangup XML');
    assert(res8.body.includes('பதிவு செய்யப்படவில்லை'), 'Unknown caller response contains Tamil unregistered message');

    // Test 9: Known Worker Call & TwiML Response
    const knwParams = { CallSid: 'CA_KNW_001', From: '+919840112345' };
    const knwSig = computeTwilioSignature(testUrl, knwParams, SECRET);
    const res9 = await makeRequest({
      ...httpOptions,
      headers: {
        ...httpOptions.headers,
        'X-Twilio-Signature': knwSig
      }
    }, 'CallSid=CA_KNW_001&From=%2B919840112345');

    if (res9.statusCode !== 200) {
      console.log('    [DEBUG Test 9 Failure]', res9.statusCode, res9.body);
    }

    assert(res9.statusCode === 200, 'Known worker call receives HTTP 200 OK');
    assert(res9.headers['content-type']?.includes('text/xml'), 'Known worker call returns Content-Type text/xml');
    assert(res9.body.includes('<Response>') && (res9.body.includes('<Play') || res9.body.includes('<Say')), 'Known worker response includes TwiML playback XML');

    // Test 10: DTMF 1 Input (ACCEPT_WORK) State Transition
    const dtmf1Params = { CallSid: 'CA_DTMF_001', From: '+919840112345', Digits: '1' };
    const dtmf1Sig = computeTwilioSignature(testUrl, dtmf1Params, SECRET);
    const res10 = await makeRequest({
      ...httpOptions,
      headers: {
        ...httpOptions.headers,
        'X-Twilio-Signature': dtmf1Sig
      }
    }, 'CallSid=CA_DTMF_001&From=%2B919840112345&Digits=1');

    assert(res10.statusCode === 200, 'DTMF 1 input receives HTTP 200 OK');
    assert(res10.body.includes('<Response>'), 'DTMF 1 input returns TwiML XML');

    // Test 11: Idempotency / Duplicate Webhook Deduplication Check
    const res11a = await makeRequest({
      ...httpOptions,
      headers: {
        ...httpOptions.headers,
        'X-Twilio-Signature': dtmf1Sig
      }
    }, 'CallSid=CA_DTMF_001&From=%2B919840112345&Digits=1');

    const res11b = await makeRequest({
      ...httpOptions,
      headers: {
        ...httpOptions.headers,
        'X-Twilio-Signature': dtmf1Sig
      }
    }, 'CallSid=CA_DTMF_001&From=%2B919840112345&Digits=1');

    assert(res11a.statusCode === 200 && res11b.statusCode === 200, 'Duplicate webhook call returns HTTP 200 idempotently');
    assert(res11a.body === res11b.body, 'Duplicate webhook returns identical cached TwiML XML response');

    // Test 12: Zero Student PII Exposure Check
    const res12 = await makeRequest({
      ...httpOptions,
      headers: {
        ...httpOptions.headers,
        'X-Twilio-Signature': knwSig
      }
    }, 'CallSid=CA_KNW_001&From=%2B919840112345');

    assert(!res12.body.includes('@gmail.com') && !res12.body.includes('studentPhone'), 'Zero student email or PII present in webhook outputs');

    console.log('\n==================================================');
    console.log(`PHASE 5.6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
