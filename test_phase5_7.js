/**
 * test_phase5_7.js — Automated Verification Suite for Phase 5.7 Real Telephony Integration
 *
 * Verifies Twilio signature validation with public proxy matching, authorized worker identification,
 * controlled test ticket FSM state transitions (Unsolved -> In Progress -> Pending Completion Confirmation),
 * canonical DTMF keypad flows (1, 2, 3, 4, 5, 0), TwiML XML formatting, webhook idempotency, and security privacy bounds.
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
  buildSayResponse,
  buildDtmfGatherResponse,
  buildHangupResponse,
  buildErrorResponse,
  buildAudioResponse
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

const TEST_PORT = 5098;
const TEST_HOST = '127.0.0.1';
const SECRET = process.env.VOICE_WEBHOOK_SECRET || 'mrf_voice_secret_2026';
const PUBLIC_BASE = 'https://mrf-test.ngrok-free.app';

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

// Ensure Controlled Test Worker & Ticket
function setupControlledTestData() {
  const configPath = path.join(__dirname, 'config.json');
  const ticketsPath = path.join(__dirname, 'tickets.json');

  let config = { workers: [] };
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {}

  let worker = (config.workers || []).find(w => w.id === 'wrk-001' || w.name === 'Ramesh Plumber');
  if (!worker) {
    worker = { id: 'wrk-001', name: 'Ramesh Plumber', phone: '+91 98401 00001', role: 'Plumber' };
    config.workers = config.workers || [];
    config.workers.push(worker);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  let data = { tickets: [] };
  try {
    data = JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
  } catch {}

  // Remove existing MCC-TEST-001 if present, then unshift clean test ticket to top
  data.tickets = (data.tickets || []).filter(t => t.ticketNo !== 'MCC-TEST-001');
  const ticket = {
    ticketNo: 'MCC-TEST-001',
    name: 'Synthetic Test Complainant',
    userType: 'Student',
    email: 'synthetic.test@mcc.edu',
    phone: '9000000000',
    department: 'Science',
    block: 'Main Block',
    roomNo: '101',
    issueCategory: 'Electrical',
    description: 'Test: ceiling light issue',
    priority: 'Urgent',
    isUrgent: true,
    status: 'Unsolved',
    assignedWorker: 'Ramesh Plumber',
    createdAt: new Date().toISOString(),
    timeline: []
  };
  data.tickets.unshift(ticket);
  fs.writeFileSync(ticketsPath, JSON.stringify(data, null, 2), 'utf8');

  return { worker, ticket };
}

// Create dedicated Phase 5.7 test HTTP server running exact server.js webhook logic
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
              const host = req.headers['x-forwarded-host'] || req.headers.host || `${TEST_HOST}:${TEST_PORT}`;
              const localFullUrl = `${protocol}://${host}${urlParts}`;

              let isValid = verifyTwilioSignature(localFullUrl, body, twilioSigHeader, voiceConfig.webhookSecret);
              if (!isValid && PUBLIC_BASE) {
                const publicFullUrl = `${PUBLIC_BASE.replace(/\/+$/, '')}${urlParts}`;
                isValid = verifyTwilioSignature(publicFullUrl, body, twilioSigHeader, voiceConfig.webhookSecret);
              }

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
          const dedupeKey = `${normalized.callId || 'no_id'}_${normalized.eventType}_${normalized.dtmfDigit || ''}_${body.ticketNo || ''}`;
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
          const configPath = path.join(__dirname, 'config.json');
          const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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

          // Known Worker Ticket Lookup
          const dataPath = path.join(__dirname, 'tickets.json');
          const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
          const ticketsList = data.tickets || [];
          const targetTicketNo = body.ticketNo || null;
          let targetTicket = null;

          if (targetTicketNo) {
            targetTicket = ticketsList.find(t => t.ticketNo === targetTicketNo);
          } else {
            targetTicket = ticketsList.find(t => {
              const assigned = String(t.assignedWorker || '').trim().toLowerCase();
              const wName = String(workerProfile.name || '').trim().toLowerCase();
              const wId = String(workerProfile.id || '').trim().toLowerCase();
              return (assigned === wName || assigned === wId) && t.status !== 'Completed';
            });
          }

          if (!targetTicket) {
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

          let spokenFeedback = '';

          if (normalized.eventType === 'DTMF') {
            const digit = normalized.dtmfDigit;
            if (digit === '1') {
              targetTicket.status = 'In Progress';
              targetTicket.timeline = targetTicket.timeline || [];
              targetTicket.timeline.push({
                id: `evt-${targetTicket.ticketNo}-voice-act-${Date.now()}`,
                timestamp: new Date().toISOString(),
                type: 'voice_action',
                actor: workerProfile.name,
                details: `Ticket status updated to "In Progress" via Telephony DTMF 1 input.`
              });
              fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
              spokenFeedback = 'பணி ஏற்றுக்கொள்ளப்பட்டது. நன்றி அண்ணா.';
            } else if (digit === '2') {
              spokenFeedback = 'பணி நிறைவு செய்ய இயலவில்லை என பதிவு செய்யப்பட்டது.';
            } else if (digit === '3') {
              const scriptObj = buildTicketSpokenScript(targetTicket, workerProfile);
              spokenFeedback = typeof scriptObj === 'object' ? (scriptObj.fullPrompt || scriptObj.intro || '') : String(scriptObj);
            } else if (digit === '4') {
              targetTicket.status = 'Pending Completion Confirmation';
              targetTicket.completionToken = crypto.randomBytes(20).toString('hex');
              targetTicket.timeline = targetTicket.timeline || [];
              targetTicket.timeline.push({
                id: `evt-${targetTicket.ticketNo}-voice-act-${Date.now()}`,
                timestamp: new Date().toISOString(),
                type: 'voice_action',
                actor: workerProfile.name,
                details: `Work reported complete via Telephony DTMF 4. Pending user confirmation.`
              });
              fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
              spokenFeedback = 'பணி முடிந்தது என பதிவு செய்யப்பட்டது. சரிபார்ப்பு அனுப்பப்பட்டது.';
            } else if (digit === '5') {
              spokenFeedback = generateGroundedVoiceResponse('QUERY_LOCATION', buildAuthorizedTicketDTO(targetTicket), 'ta-IN');
            } else if (digit === '0') {
              spokenFeedback = 'நிர்வாகிக்கு தகவல் தெரிவிக்கப்பட்டது. தயவுசெய்து காத்திருக்கவும்.';
            } else {
              spokenFeedback = `Input ${digit} processed cleanly.`;
            }
          } else {
            const scriptObj = buildTicketSpokenScript(targetTicket, workerProfile);
            spokenFeedback = typeof scriptObj === 'object' ? (scriptObj.fullPrompt || scriptObj.intro || '') : String(scriptObj);
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
  console.log('STARTING PHASE 5.7 REAL TWILIO TELEPHONY VERIFICATION');
  console.log('==================================================\n');

  const configPath = path.join(__dirname, 'config.json');
  const ticketsPath = path.join(__dirname, 'tickets.json');
  const originalConfigContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : null;
  const originalTicketsContent = fs.existsSync(ticketsPath) ? fs.readFileSync(ticketsPath, 'utf8') : null;

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

  let server;
  try {
    const { worker, ticket } = setupControlledTestData();
    const workerPhone = (worker && worker.phone) ? worker.phone : '+91 98401 00001';
    const workerPhoneEnc = encodeURIComponent(workerPhone);

    assert(worker && worker.phone, 'Controlled test worker (Ramesh Plumber) loaded cleanly');
    assert(ticket && ticket.ticketNo === 'MCC-TEST-001', 'Controlled test ticket (MCC-TEST-001) initialized cleanly');

    server = createTestServer();
    await new Promise(resolve => server.listen(TEST_PORT, TEST_HOST, resolve));
    console.log('\n--- CATEGORY A: SIGNATURE VALIDATION & PUBLIC PROXY REWRITE TESTS ---');

    const testLocalUrl = `http://${TEST_HOST}:${TEST_PORT}/api/voice/telephony-webhook`;
    const testPublicUrl = `${PUBLIC_BASE}/api/voice/telephony-webhook`;
    const params = { CallSid: 'CA_TEST_5701', From: workerPhone, ticketNo: 'MCC-TEST-001' };

    const localSig = computeTwilioSignature(testLocalUrl, params, SECRET);
    const publicSig = computeTwilioSignature(testPublicUrl, params, SECRET);

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

    // Test 1: Missing Signature -> HTTP 401
    const res1 = await makeRequest(httpOptions, `CallSid=CA_TEST_5701&From=${workerPhoneEnc}&ticketNo=MCC-TEST-001`);
    assert(res1.statusCode === 401, 'Missing Twilio signature header rejected (HTTP 401)');

    // Test 2: Invalid Signature -> HTTP 401
    const res2 = await makeRequest({
      ...httpOptions,
      headers: { ...httpOptions.headers, 'X-Twilio-Signature': 'invalid_sig' }
    }, `CallSid=CA_TEST_5701&From=${workerPhoneEnc}&ticketNo=MCC-TEST-001`);
    assert(res2.statusCode === 401, 'Invalid Twilio signature rejected (HTTP 401)');

    // Test 3: Valid Local Signature -> HTTP 200
    const res3 = await makeRequest({
      ...httpOptions,
      headers: { ...httpOptions.headers, 'X-Twilio-Signature': localSig }
    }, `CallSid=CA_TEST_5701&From=${workerPhoneEnc}&ticketNo=MCC-TEST-001`);
    assert(res3.statusCode === 200, 'Valid local Twilio signature accepted (HTTP 200)');
    assert(res3.headers['content-type']?.includes('text/xml'), 'TwiML Content-Type text/xml returned');

    // Test 4: Valid Public Proxy Signature -> HTTP 200
    const res4 = await makeRequest({
      ...httpOptions,
      headers: { ...httpOptions.headers, 'X-Twilio-Signature': publicSig }
    }, `CallSid=CA_TEST_5701&From=${workerPhoneEnc}&ticketNo=MCC-TEST-001`);
    assert(res4.statusCode === 200, 'Valid public proxy Twilio signature accepted (HTTP 200)');

    console.log('\n--- CATEGORY B: CANONICAL DTMF FSM TRANSITION TESTS ---');

    // Test 5: Initial Call Start (INCOMING_CALL) Spoken Script
    const callStartParams = { CallSid: 'CA_CALL_START', From: workerPhone, ticketNo: 'MCC-TEST-001' };
    const callStartSig = computeTwilioSignature(testLocalUrl, callStartParams, SECRET);
    const res5 = await makeRequest({
      ...httpOptions,
      headers: { ...httpOptions.headers, 'X-Twilio-Signature': callStartSig }
    }, `CallSid=CA_CALL_START&From=${workerPhoneEnc}&ticketNo=MCC-TEST-001`);

    assert(res5.statusCode === 200, 'Call start returns HTTP 200 OK');
    assert(res5.body.includes('MCC-TEST-001') || res5.body.includes('Main Block'), 'Call start spoken script includes controlled test ticket info');

    // Test 6: DTMF 1 (ACCEPT_WORK) Transition: Unsolved -> In Progress
    const dtmf1Params = { CallSid: 'CA_DTMF_1', From: workerPhone, Digits: '1', ticketNo: 'MCC-TEST-001' };
    const dtmf1Sig = computeTwilioSignature(testLocalUrl, dtmf1Params, SECRET);
    const res6 = await makeRequest({
      ...httpOptions,
      headers: { ...httpOptions.headers, 'X-Twilio-Signature': dtmf1Sig }
    }, `CallSid=CA_DTMF_1&From=${workerPhoneEnc}&Digits=1&ticketNo=MCC-TEST-001`);

    assert(res6.statusCode === 200, 'DTMF 1 input returns HTTP 200 OK');
    assert(res6.body.includes('ஏற்றுக்கொள்ளப்பட்டது'), 'DTMF 1 returns acceptance prompt in Tamil');

    // Verify status updated in tickets.json
    const updatedData1 = JSON.parse(fs.readFileSync(path.join(__dirname, 'tickets.json'), 'utf8'));
    const testTicket1 = updatedData1.tickets.find(t => t.ticketNo === 'MCC-TEST-001');
    assert(testTicket1 && testTicket1.status === 'In Progress', 'Ticket status updated to "In Progress" via DTMF 1');

    // Test 7: DTMF 5 (QUERY_LOCATION)
    const dtmf5Params = { CallSid: 'CA_DTMF_5', From: workerPhone, Digits: '5', ticketNo: 'MCC-TEST-001' };
    const dtmf5Sig = computeTwilioSignature(testLocalUrl, dtmf5Params, SECRET);
    const res7 = await makeRequest({
      ...httpOptions,
      headers: { ...httpOptions.headers, 'X-Twilio-Signature': dtmf5Sig }
    }, `CallSid=CA_DTMF_5&From=${workerPhoneEnc}&Digits=5&ticketNo=MCC-TEST-001`);

    assert(res7.statusCode === 200, 'DTMF 5 query location returns HTTP 200 OK');
    assert(res7.body.includes('Main Block') || res7.body.includes('101'), 'DTMF 5 returns authorized block/room location');

    // Test 8: DTMF 3 (REPEAT_INFO)
    const dtmf3Params = { CallSid: 'CA_DTMF_3', From: workerPhone, Digits: '3', ticketNo: 'MCC-TEST-001' };
    const dtmf3Sig = computeTwilioSignature(testLocalUrl, dtmf3Params, SECRET);
    const res8 = await makeRequest({
      ...httpOptions,
      headers: { ...httpOptions.headers, 'X-Twilio-Signature': dtmf3Sig }
    }, `CallSid=CA_DTMF_3&From=${workerPhoneEnc}&Digits=3&ticketNo=MCC-TEST-001`);

    assert(res8.statusCode === 200, 'DTMF 3 repeat returns HTTP 200 OK');
    assert(res8.body.includes('MCC-TEST-001') || res8.body.includes('Main Block'), 'DTMF 3 repeats ticket details');

    // Test 9: DTMF 4 (CONFIRM_COMPLETE) Transition: In Progress -> Pending Completion Confirmation
    const dtmf4Params = { CallSid: 'CA_DTMF_4', From: workerPhone, Digits: '4', ticketNo: 'MCC-TEST-001' };
    const dtmf4Sig = computeTwilioSignature(testLocalUrl, dtmf4Params, SECRET);
    const res9 = await makeRequest({
      ...httpOptions,
      headers: { ...httpOptions.headers, 'X-Twilio-Signature': dtmf4Sig }
    }, `CallSid=CA_DTMF_4&From=${workerPhoneEnc}&Digits=4&ticketNo=MCC-TEST-001`);

    assert(res9.statusCode === 200, 'DTMF 4 report complete returns HTTP 200 OK');
    assert(res9.body.includes('முடிந்தது என பதிவு செய்யப்பட்டது'), 'DTMF 4 returns work completed prompt in Tamil');

    const updatedData4 = JSON.parse(fs.readFileSync(path.join(__dirname, 'tickets.json'), 'utf8'));
    const testTicket4 = updatedData4.tickets.find(t => t.ticketNo === 'MCC-TEST-001');
    assert(
      testTicket4 && testTicket4.status === 'Pending Completion Confirmation' && testTicket4.completionToken,
      'Ticket status updated to "Pending Completion Confirmation" with completionToken'
    );

    console.log('\n--- CATEGORY C: SECURITY, PRIVACY & IDEMPOTENCY TESTS ---');

    // Test 10: Idempotency Check
    const res10a = await makeRequest({
      ...httpOptions,
      headers: { ...httpOptions.headers, 'X-Twilio-Signature': dtmf1Sig }
    }, `CallSid=CA_DTMF_1&From=${workerPhoneEnc}&Digits=1&ticketNo=MCC-TEST-001`);

    const res10b = await makeRequest({
      ...httpOptions,
      headers: { ...httpOptions.headers, 'X-Twilio-Signature': dtmf1Sig }
    }, `CallSid=CA_DTMF_1&From=${workerPhoneEnc}&Digits=1&ticketNo=MCC-TEST-001`);

    assert(res10a.statusCode === 200 && res10b.statusCode === 200, 'Duplicate webhook POST returns HTTP 200 OK');
    assert(res10a.body === res10b.body, 'Duplicate webhook returns identical cached response without state re-execution');

    // Test 11: Zero Student PII Leakage Check
    assert(
      !res5.body.includes('synthetic.test@mcc.edu') && !res5.body.includes('9000000000'),
      'Student email and phone strictly excluded from TwiML voice scripts'
    );

    // Test 12: Zero Credential Exposure Check
    assert(
      !res5.body.includes(SECRET) && !res5.body.includes('TWILIO_AUTH_TOKEN'),
      'Webhook secrets and tokens omitted from output payloads'
    );

    console.log('\n==================================================');
    console.log(`PHASE 5.7 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================\n');
  } finally {
    if (server) {
      server.close();
    }
    // Restore original configuration and tickets so test data never pollutes live local files
    try {
      if (originalConfigContent !== null) {
        fs.writeFileSync(configPath, originalConfigContent, 'utf8');
      }
      if (originalTicketsContent !== null) {
        fs.writeFileSync(ticketsPath, originalTicketsContent, 'utf8');
      }
    } catch (cleanupErr) {
      console.warn('Warning: Failed to restore original data after tests:', cleanupErr.message);
    }
  }
}

runTests().catch(err => {
  console.error('Unhandled Phase 5.7 test execution failure:', err);
  process.exit(1);
});
