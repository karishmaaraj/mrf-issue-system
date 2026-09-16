/**
 * telephonyAdapter.js — Telephony Provider Adapter & Secure Webhook Layer for MCC FIX HUB
 *
 * Provides a provider-neutral abstraction layer between Telephony Providers
 * (e.g. Exotel, Twilio, Plivo, Tata Tele) and the internal MCC FIX HUB voice automation engine.
 *
 * STRICT SECURITY CONSTRAINTS:
 * 1. Zero business logic or ticket state mutation.
 * 2. Zero raw PII, PINs, secrets, or token exposure in logs or payloads.
 * 3. Provider-neutral canonical DTMF mapping & event structure.
 * 4. Deterministic FSM validation remains strictly in backend server routines.
 */

// Canonical DTMF Mapping for MCC FIX HUB Keypad Fallback Menu
export const CANONICAL_DTMF_MAP = Object.freeze({
  '1': { intent: 'ACCEPT_WORK', description: 'ACCEPT / START WORK' },
  '2': { intent: 'CANNOT_COMPLETE', description: 'CANNOT COMPLETE' },
  '3': { intent: 'REPEAT_INFO', description: 'REPEAT' },
  '4': { intent: 'CONFIRM_COMPLETE', description: 'REPORT WORK COMPLETED' },
  '5': { intent: 'QUERY_LOCATION', description: 'HEAR LOCATION / ROOM' },
  '0': { intent: 'TALK_TO_ADMIN', description: 'ADMIN / MAIN MENU' }
});

// Sensitive field keys that must be stripped before logging or storing raw payloads
const SENSITIVE_KEYS = new Set([
  'api_key', 'apikey', 'secret', 'webhooksecret', 'token', 'pin', 'pinhash',
  'completiontoken', 'userverifytoken', 'auth', 'cookie', 'authorization',
  'password', 'key', 'x-voice-signature', 'x-voice-simulator-key'
]);

/**
 * Strips sensitive credentials, PINs, tokens, and authorization headers from payload objects.
 */
export function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const clean = {};
  for (const [key, val] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      clean[key] = sanitizePayload(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Standardizes caller phone number to international E.164 format (+91XXXXXXXXXX)
 */
export function formatPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+91${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Normalizes an incoming call payload into the internal provider-neutral structure.
 */
export function normalizeIncomingCall(rawPayload, provider = 'generic') {
  const payload = rawPayload || {};
  const callId = String(payload.callId || payload.CallSid || payload.call_id || payload.session_id || '').trim();
  const callerPhone = formatPhoneNumber(payload.callerPhone || payload.From || payload.from_number || payload.caller_number || payload.phone);

  return {
    success: true,
    callId: callId || null,
    callerPhone: callerPhone || null,
    eventType: 'INCOMING_CALL',
    dtmfDigit: null,
    intent: null,
    speechAvailable: !!(payload.speechInput || payload.SpeechResult || payload.transcript),
    provider: String(provider || 'generic').toLowerCase(),
    rawProviderPayload: sanitizePayload(payload)
  };
}

/**
 * Normalizes a DTMF keypad input payload into canonical MCC FIX HUB representation.
 */
export function normalizeDtmfInput(rawPayload, provider = 'generic') {
  const payload = rawPayload || {};
  const callId = String(payload.callId || payload.CallSid || payload.call_id || payload.session_id || '').trim();
  const callerPhone = formatPhoneNumber(payload.callerPhone || payload.From || payload.from_number || payload.caller_number || payload.phone);
  
  const rawDigit = String(payload.dtmfDigit || payload.Digits || payload.digits || payload.dtmf || '').trim();
  const dtmfDigit = rawDigit.length > 0 ? rawDigit.charAt(0) : null;
  
  const mapping = dtmfDigit ? CANONICAL_DTMF_MAP[dtmfDigit] : null;

  return {
    success: true,
    callId: callId || null,
    callerPhone: callerPhone || null,
    eventType: 'DTMF',
    dtmfDigit: dtmfDigit || null,
    intent: mapping ? mapping.intent : 'UNKNOWN',
    description: mapping ? mapping.description : 'UNKNOWN_DTMF',
    speechAvailable: false,
    provider: String(provider || 'generic').toLowerCase(),
    rawProviderPayload: sanitizePayload(payload)
  };
}

/**
 * Normalizes call status events (CONNECTED, ENDED, FAILED).
 */
export function normalizeCallEvent(rawPayload, provider = 'generic') {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return {
      success: false,
      error: 'Unsupported or malformed call event',
      rawProviderPayload: {}
    };
  }

  const payload = rawPayload;
  const callId = String(payload.callId || payload.CallSid || payload.call_id || payload.session_id || '').trim();
  const callerPhone = formatPhoneNumber(payload.callerPhone || payload.From || payload.from_number || payload.caller_number || payload.phone);

  // Validate required call identity attributes
  if (!callId || !callerPhone) {
    return {
      success: false,
      error: 'Invalid or missing required call attributes (callId, callerPhone)',
      rawProviderPayload: sanitizePayload(payload)
    };
  }

  // Determine Event Type
  let eventType = String(payload.eventType || payload.event || payload.CallStatus || '').toUpperCase();

  if (payload.dtmfDigit !== undefined || payload.Digits !== undefined || payload.digits !== undefined || payload.dtmf !== undefined) {
    return normalizeDtmfInput(payload, provider);
  }

  if (eventType === 'INCOMING_CALL' || eventType === 'RINGING' || eventType === 'QUEUED') {
    return normalizeIncomingCall(payload, provider);
  }

  if (eventType === 'CONNECTED' || eventType === 'IN-PROGRESS' || eventType === 'CALL_CONNECTED') {
    return {
      success: true,
      callId,
      callerPhone,
      eventType: 'CALL_CONNECTED',
      dtmfDigit: null,
      intent: null,
      speechAvailable: false,
      provider: String(provider || 'generic').toLowerCase(),
      rawProviderPayload: sanitizePayload(payload)
    };
  }

  if (eventType === 'ENDED' || eventType === 'COMPLETED' || eventType === 'CALL_ENDED' || eventType === 'HANGUP') {
    return {
      success: true,
      callId,
      callerPhone,
      eventType: 'CALL_ENDED',
      dtmfDigit: null,
      intent: null,
      speechAvailable: false,
      provider: String(provider || 'generic').toLowerCase(),
      rawProviderPayload: sanitizePayload(payload)
    };
  }

  if (eventType === 'FAILED' || eventType === 'BUSY' || eventType === 'NO-ANSWER' || eventType === 'CALL_FAILED' || eventType === 'CANCELED') {
    return {
      success: true,
      callId,
      callerPhone,
      eventType: 'CALL_FAILED',
      dtmfDigit: null,
      intent: null,
      speechAvailable: false,
      provider: String(provider || 'generic').toLowerCase(),
      rawProviderPayload: sanitizePayload(payload)
    };
  }

  // Fallback for default incoming call when callId & callerPhone are valid
  return normalizeIncomingCall(payload, provider);
}

/**
 * Creates an immutable call session binding object linking callId + workerId + ticketNo.
 */
export function bindCallSession(callId, workerId, ticketNo = null) {
  return Object.freeze({
    callId: String(callId).trim(),
    workerId: String(workerId).trim(),
    ticketNo: ticketNo ? String(ticketNo).trim() : null,
    boundAt: new Date().toISOString()
  });
}

/**
 * Validates session context access to prevent cross-worker ticket data exposure.
 */
export function validateCallSessionAccess(sessionBinding, workerProfile, targetTicket) {
  if (!sessionBinding || !workerProfile || !targetTicket) {
    return { allowed: false, reason: 'Missing session or profile context' };
  }

  const workerIdClean = String(workerProfile.id || workerProfile.workerId || '').trim().toLowerCase();
  const workerNameClean = String(workerProfile.name || '').trim().toLowerCase();

  const boundWorkerId = String(sessionBinding.workerId || '').trim().toLowerCase();
  if (boundWorkerId !== workerIdClean && boundWorkerId !== workerNameClean) {
    return { allowed: false, reason: 'Session workerId mismatch' };
  }

  const assignedWorker = String(targetTicket.assignedWorker || '').trim().toLowerCase();
  if (assignedWorker !== workerIdClean && assignedWorker !== workerNameClean) {
    return { allowed: false, reason: 'Cross-worker ticket access attempt denied' };
  }

  return { allowed: true };
}

/**
 * Internal Rate Limiter store for webhook endpoints (sliding window)
 */
const rateLimitStore = new Map();

/**
 * Checks sliding-window rate limit per caller/IP (default max 30 req/min).
 */
export function checkWebhookRateLimit(clientId, maxRequests = 30, windowMs = 60000) {
  if (!clientId) return { allowed: true };
  const now = Date.now();
  const clientWindow = rateLimitStore.get(clientId) || [];

  // Remove timestamps outside window
  const validTimestamps = clientWindow.filter(ts => now - ts < windowMs);

  if (validTimestamps.length >= maxRequests) {
    return { allowed: false, error: 'Too Many Requests: Rate limit exceeded' };
  }

  validTimestamps.push(now);
  rateLimitStore.set(clientId, validTimestamps);
  return { allowed: true };
}

/**
 * Formats a provider-neutral internal response representation into target telephony payload.
 */
export function buildVoiceResponse(internalAction, provider = 'generic') {
  const action = internalAction && internalAction.action ? internalAction.action : 'SAY';
  const text = internalAction && internalAction.text ? internalAction.text : '';
  const language = internalAction && internalAction.language ? internalAction.language : 'ta-IN';
  const nextAction = internalAction && internalAction.nextAction ? internalAction.nextAction : null;

  const normalizedProvider = String(provider || 'generic').toLowerCase();

  const responseObj = {
    action,
    text,
    language,
    nextAction
  };

  switch (normalizedProvider) {
    case 'twilio': {
      let twiml = `<Response><Say language="${language}">${text}</Say>`;
      if (nextAction === 'GATHER_DTMF') {
        twiml += `<Gather numDigits="1" timeout="5"></Gather>`;
      } else if (nextAction === 'HANGUP') {
        twiml += `<Hangup/>`;
      }
      twiml += `</Response>`;
      return {
        success: true,
        provider: 'twilio',
        twiml,
        internalResponse: responseObj
      };
    }

    case 'exotel': {
      return {
        success: true,
        provider: 'exotel',
        passthru: {
          select: action,
          text,
          language,
          next: nextAction
        },
        internalResponse: responseObj
      };
    }

    case 'generic':
    default: {
      return {
        success: true,
        provider: 'generic',
        response: responseObj
      };
    }
  }
}

/**
 * Helper: Builds a provider-neutral SAY response.
 */
export function buildSayResponse(text, language = 'ta-IN', provider = 'generic') {
  return buildVoiceResponse({ action: 'SAY', text, language, nextAction: 'CONTINUE' }, provider);
}

/**
 * Helper: Builds a provider-neutral DTMF GATHER response.
 */
export function buildDtmfGatherResponse(promptText, language = 'ta-IN', provider = 'generic') {
  return buildVoiceResponse({ action: 'GATHER_DTMF', text: promptText, language, nextAction: 'GATHER_DTMF' }, provider);
}

/**
 * Helper: Builds a provider-neutral HANGUP response.
 */
export function buildHangupResponse(text, language = 'ta-IN', provider = 'generic') {
  return buildVoiceResponse({ action: 'HANGUP', text, language, nextAction: 'HANGUP' }, provider);
}

/**
 * Helper: Builds a provider-neutral ERROR response.
 */
export function buildErrorResponse(errorMsg, provider = 'generic') {
  return buildVoiceResponse({ action: 'ERROR', text: errorMsg, language: 'ta-IN', nextAction: 'HANGUP' }, provider);
}
