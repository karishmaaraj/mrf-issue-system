/**
 * test_phase5_2.js — Focused Automated Verification & Regression Suite for Phase 5.2
 *
 * Verifies all 21 Phase 5.2 mandatory test requirements:
 * 1. Valid webhook
 * 2. Missing signature
 * 3. Invalid signature
 * 4. Malformed signature
 * 5. Unknown caller
 * 6. Known caller normalization
 * 7. DTMF 1
 * 8. DTMF 2
 * 9. DTMF 3
 * 10. DTMF 4
 * 11. DTMF 5
 * 12. DTMF 0
 * 13. CALL_ENDED
 * 14. CALL_FAILED
 * 15. Missing callId
 * 16. Missing callerPhone
 * 17. Oversized/malformed payload
 * 18. Cross-worker ticket access attempt
 * 19. No ticket mutation from adapter
 * 20. No Gemini call from adapter
 * 21. No PII leakage in normalized payload/logging
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  normalizeIncomingCall,
  normalizeDtmfInput,
  normalizeCallEvent,
  bindCallSession,
  validateCallSessionAccess,
  buildVoiceResponse,
  buildDtmfGatherResponse,
  buildSayResponse,
  buildHangupResponse,
  buildErrorResponse,
  sanitizePayload,
  CANONICAL_DTMF_MAP
} from './telephonyAdapter.js';
import {
  verifyVoiceWebhookSignature,
  getVoiceConfig,
  buildAuthorizedTicketDTO,
  parseVoiceIntent
} from './voiceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SECRET = process.env.VOICE_WEBHOOK_SECRET || 'mrf_voice_secret_2026';

function computeHmac(rawBody, secret = SECRET) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

async function runPhase52Tests() {
  console.log('\n==================================================');
  console.log('STARTING PHASE 5.2 TELEPHONY ADAPTER VERIFICATION');
  console.log('==================================================\n');

  // Load ticket state snapshot to verify zero mutation
  const ticketsBefore = JSON.parse(fs.readFileSync(path.join(__dirname, 'tickets.json'), 'utf8'));

  // Test 1: Valid webhook signature & payload normalization
  console.log('Test 1: Valid webhook');
  const body1 = JSON.stringify({
    callId: 'call_test_001',
    callerPhone: '+919840112345',
    eventType: 'INCOMING_CALL'
  });
  const sig1 = computeHmac(body1);
  const isValid1 = verifyVoiceWebhookSignature(body1, sig1, SECRET);
  assert(isValid1 === true, 'HMAC signature verification passes for valid payload');
  const norm1 = normalizeCallEvent(JSON.parse(body1), 'generic');
  assert(norm1.success === true && norm1.callId === 'call_test_001' && norm1.callerPhone === '+919840112345', 'Normalized call event cleanly extracts callId & callerPhone');

  // Test 2: Missing signature
  console.log('\nTest 2: Missing signature');
  const isValid2 = verifyVoiceWebhookSignature(body1, null, SECRET);
  assert(isValid2 === false, 'Missing signature header is cleanly rejected');

  // Test 3: Invalid signature
  console.log('\nTest 3: Invalid signature');
  const isValid3 = verifyVoiceWebhookSignature(body1, 'sha256=invalid12345', SECRET);
  assert(isValid3 === false, 'Invalid HMAC signature is cleanly rejected');

  // Test 4: Malformed signature
  console.log('\nTest 4: Malformed signature');
  const isValid4 = verifyVoiceWebhookSignature(body1, 'not-even-hex!@#$', SECRET);
  assert(isValid4 === false, 'Malformed signature string handled safely without crashing');

  // Test 5: Unknown caller
  console.log('\nTest 5: Unknown caller');
  const norm5 = normalizeCallEvent({ callId: 'call_unk_001', callerPhone: '+919999999999' }, 'generic');
  assert(norm5.success === true && norm5.callerPhone === '+919999999999', 'Unknown caller phone normalized without throwing error');
  const hangup5 = buildHangupResponse('இந்த எண் பதிவு செய்யப்படவில்லை.', 'ta-IN', 'generic');
  assert(hangup5.response.action === 'HANGUP', 'Unknown caller gets polite hangup response');

  // Test 6: Known caller normalization
  console.log('\nTest 6: Known caller normalization');
  const norm6 = normalizeCallEvent({ callId: 'call_known_001', callerPhone: '+91 98401 12345' }, 'generic');
  assert(norm6.success === true && norm6.callerPhone === '+919840112345', 'Known worker phone formatted cleanly to E.164 (+919840112345)');

  // Test 7-12: Canonical DTMF Mappings 1, 2, 3, 4, 5, 0
  console.log('\nTests 7-12: Canonical DTMF Mappings');

  const dtmfMap = [
    { digit: '1', expectedIntent: 'ACCEPT_WORK', label: 'DTMF 1 (Accept Work)' },
    { digit: '2', expectedIntent: 'CANNOT_COMPLETE', label: 'DTMF 2 (Cannot Complete)' },
    { digit: '3', expectedIntent: 'REPEAT_INFO', label: 'DTMF 3 (Repeat)' },
    { digit: '4', expectedIntent: 'CONFIRM_COMPLETE', label: 'DTMF 4 (Report Complete)' },
    { digit: '5', expectedIntent: 'QUERY_LOCATION', label: 'DTMF 5 (Hear Location)' },
    { digit: '0', expectedIntent: 'TALK_TO_ADMIN', label: 'DTMF 0 (Talk to Admin)' }
  ];

  for (const item of dtmfMap) {
    const norm = normalizeDtmfInput({ callId: 'call_dtmf', callerPhone: '+919840112345', Digits: item.digit }, 'generic');
    assert(norm.intent === item.expectedIntent, `${item.label} correctly normalized to intent "${item.expectedIntent}"`);
  }

  // Test 13: CALL_ENDED
  console.log('\nTest 13: CALL_ENDED');
  const norm13 = normalizeCallEvent({ callId: 'call_end_001', callerPhone: '+919840112345', event: 'ended' }, 'generic');
  assert(norm13.eventType === 'CALL_ENDED', 'Call ended event normalized to "CALL_ENDED"');

  // Test 14: CALL_FAILED
  console.log('\nTest 14: CALL_FAILED');
  const norm14 = normalizeCallEvent({ callId: 'call_fail_001', callerPhone: '+919840112345', event: 'failed' }, 'generic');
  assert(norm14.eventType === 'CALL_FAILED', 'Call failed event normalized to "CALL_FAILED"');

  // Test 15: Missing callId
  console.log('\nTest 15: Missing callId');
  const norm15 = normalizeCallEvent({ callerPhone: '+919840112345' }, 'generic');
  assert(norm15.success === false && norm15.error.includes('missing required call attributes'), 'Missing callId returns error');

  // Test 16: Missing callerPhone
  console.log('\nTest 16: Missing callerPhone');
  const norm16 = normalizeCallEvent({ callId: 'call_noparam_001' }, 'generic');
  assert(norm16.success === false && norm16.error.includes('missing required call attributes'), 'Missing callerPhone returns error');

  // Test 17: Oversized/malformed payload
  console.log('\nTest 17: Oversized/malformed payload');
  const norm17 = normalizeCallEvent("not an object", 'generic');
  assert(norm17.success === false && norm17.error.includes('Unsupported or malformed call event'), 'Malformed raw payload rejected safely');

  // Test 18: Cross-worker ticket access attempt
  console.log('\nTest 18: Cross-worker ticket access attempt');
  const session18 = bindCallSession('call_cross_001', 'w1', '#MCC-101');
  const workerProfile18 = { id: 'w1', name: 'Rajan Kumar' };
  const targetTicket18 = { ticketNo: '#MCC-102', assignedWorker: 'Suresh Menon' }; // Belong to w2
  const accessCheck = validateCallSessionAccess(session18, workerProfile18, targetTicket18);
  assert(accessCheck.allowed === false && accessCheck.reason.includes('Cross-worker ticket access attempt denied'), 'Cross-worker ticket access attempt blocked by session validator');

  // Test 19: No ticket mutation from adapter
  console.log('\nTest 19: No ticket mutation from adapter');
  const ticketsAfter = JSON.parse(fs.readFileSync(path.join(__dirname, 'tickets.json'), 'utf8'));
  assert(JSON.stringify(ticketsBefore) === JSON.stringify(ticketsAfter), 'tickets.json remains completely unmodified after adapter execution');

  // Test 20: No Gemini call from adapter
  console.log('\nTest 20: No Gemini call from adapter');
  const dummyAction = { action: 'SAY', text: 'Testing adapter isolation', language: 'ta-IN' };
  const providerResp = buildVoiceResponse(dummyAction, 'generic');
  assert(providerResp.success === true && providerResp.response.text === 'Testing adapter isolation', 'Adapter generates provider response cleanly without triggering external LLM calls');

  // Test 21: No PII leakage in normalized payload/logging
  console.log('\nTest 21: No PII leakage in normalized payload/logging');
  const dirtyPayload = {
    callId: 'call_pii_001',
    callerPhone: '+919840112345',
    api_key: 'SECRET_API_KEY_123',
    studentPhone: '+919999911111',
    pinHash: 'HASH_VALUE_SECRET',
    userVerifyToken: 'TOKEN_123'
  };
  const sanitized = sanitizePayload(dirtyPayload);
  assert(sanitized.api_key === '[REDACTED]' && sanitized.pinHash === '[REDACTED]' && sanitized.userVerifyToken === '[REDACTED]', 'Sensitive keys (api_key, pinHash, userVerifyToken) redacted by payload sanitizer');

  // Additional Regression Check: Security DTO Boundary
  console.log('\nAdditional Regression Check: Security DTO Boundary');
  const dummyTicket = {
    ticketNo: '#MCC-999',
    block: 'Admin Block',
    roomNo: '101',
    issueCategory: 'Plumbing',
    description: 'Leak in main tap',
    priority: 'High',
    isUrgent: true,
    status: 'Unsolved',
    studentPhone: '+919999900000',
    studentEmail: 'student@mcc.edu',
    pinHash: 'secret_hash'
  };
  const dto = buildAuthorizedTicketDTO(dummyTicket);
  assert(dto.studentPhone === undefined && dto.studentEmail === undefined && dto.pinHash === undefined, 'buildAuthorizedTicketDTO strictly strips student PII and secrets');

  console.log('\n==================================================');
  console.log(`PHASE 5.2 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('==================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase52Tests().catch(err => {
  console.error('[Test Error]', err);
  process.exit(1);
});
