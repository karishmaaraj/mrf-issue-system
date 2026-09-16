/**
 * sttService.js — Speech-to-Text (STT) Abstraction Layer for MCC FIX HUB
 *
 * Connects MCC FIX HUB to Speech-to-Text providers (Sarvam AI Saaras model, Google Cloud STT)
 * for transcribing spoken Tamil, Tanglish, and English audio from maintenance workers.
 *
 * STRICT SECURITY CONSTRAINTS:
 * 1. STT API Keys remain backend-only. Never exposed in API responses or logs.
 * 2. STT receives audio input ONLY. Receives ZERO ticket DTO, student PII, PINs, or tokens.
 * 3. STT has ZERO ticket state mutation authority.
 * 4. Safe timeout (default 3000ms via AbortController) & graceful fallbacks.
 */

import { Buffer } from 'buffer';

/**
 * Reads STT Configuration from environment variables
 */
export function getSTTConfig() {
  const provider = (process.env.STT_PROVIDER || 'sarvam').toLowerCase();
  const apiKey = process.env.STT_API_KEY || process.env.SARVAM_API_KEY || process.env.GOOGLE_STT_API_KEY || '';
  const timeoutMs = parseInt(process.env.STT_TIMEOUT_MS || '3000', 10);
  const defaultLanguage = process.env.STT_LANGUAGE || 'ta-IN';
  const model = process.env.STT_MODEL || (provider === 'sarvam' ? 'saaras:v3' : 'latest_long');

  return {
    provider,
    apiKey,
    timeoutMs,
    defaultLanguage,
    model
  };
}

/**
 * Normalizes raw audio input into a clean Buffer object
 */
export function normalizeAudioInput(audioInput) {
  if (!audioInput) return null;

  if (Buffer.isBuffer(audioInput)) {
    return { buffer: audioInput, mimeType: 'audio/wav' };
  }

  if (typeof audioInput === 'string') {
    // Handle base64 audio data URI or raw base64 string
    const base64Data = audioInput.replace(/^data:audio\/[a-z0-9]+;base64,/, '');
    try {
      const buf = Buffer.from(base64Data, 'base64');
      return { buffer: buf, mimeType: 'audio/wav' };
    } catch (err) {
      return null;
    }
  }

  if (typeof audioInput === 'object') {
    if (audioInput.buffer && Buffer.isBuffer(audioInput.buffer)) {
      return {
        buffer: audioInput.buffer,
        mimeType: audioInput.mimeType || 'audio/wav',
        sampleRate: audioInput.sampleRate || 16000
      };
    }
    if (audioInput.base64 && typeof audioInput.base64 === 'string') {
      const base64Data = audioInput.base64.replace(/^data:audio\/[a-z0-9]+;base64,/, '');
      try {
        const buf = Buffer.from(base64Data, 'base64');
        return {
          buffer: buf,
          mimeType: audioInput.mimeType || 'audio/wav',
          sampleRate: audioInput.sampleRate || 16000
        };
      } catch (err) {
        return null;
      }
    }
  }

  return null;
}

/**
 * Transcribes audio input using Sarvam AI STT API (saaras model)
 */
async function transcribeWithSarvam(audioObj, options, config) {
  const startTime = Date.now();
  const url = 'https://api.sarvam.ai/speech-to-text';
  const languageCode = options.languageCode || config.defaultLanguage || 'ta-IN';
  const model = options.model || config.model || 'saaras:v3';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || config.timeoutMs);

  try {
    // Construct standard multipart/form-data payload for Sarvam API using native Blob/FormData
    const formData = new FormData();
    const audioBlob = new Blob([audioObj.buffer], { type: audioObj.mimeType || 'audio/wav' });
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', model);
    formData.append('language_code', languageCode);
    formData.append('mode', 'transcribe');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'api-subscription-key': config.apiKey
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.warn(`[Sarvam STT Error] HTTP ${res.status}: ${res.statusText}`);
      return {
        success: false,
        transcript: '',
        errorCode: `HTTP_${res.status}`,
        error: `Sarvam STT API returned HTTP ${res.status}`,
        provider: 'sarvam',
        latencyMs
      };
    }

    const data = await res.json();
    const rawTranscript = data.transcript || data.text || '';
    const transcript = String(rawTranscript).trim();

    return {
      success: true,
      transcript,
      language: data.language_code || languageCode,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.95,
      provider: 'sarvam',
      latencyMs
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';

    console.warn(`[Sarvam STT Exception] ${isTimeout ? 'Request Timeout' : err.message}`);
    return {
      success: false,
      transcript: '',
      errorCode: isTimeout ? 'STT_TIMEOUT' : 'STT_EXCEPTION',
      error: isTimeout ? 'STT API request timed out' : err.message,
      provider: 'sarvam',
      latencyMs
    };
  }
}

/**
 * Transcribes audio input using Google Cloud Speech-to-Text API
 */
async function transcribeWithGoogle(audioObj, options, config) {
  const startTime = Date.now();
  const languageCode = options.languageCode || config.defaultLanguage || 'ta-IN';
  const url = `https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(config.apiKey)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || config.timeoutMs);

  try {
    const base64Audio = audioObj.buffer.toString('base64');
    const requestBody = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: audioObj.sampleRate || 16000,
        languageCode: languageCode
      },
      audio: {
        content: base64Audio
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      console.warn(`[Google STT Error] HTTP ${res.status}`);
      return {
        success: false,
        transcript: '',
        errorCode: `HTTP_${res.status}`,
        error: `Google STT API returned HTTP ${res.status}`,
        provider: 'google',
        latencyMs
      };
    }

    const data = await res.json();
    const resultObj = data.results?.[0]?.alternatives?.[0];
    const transcript = resultObj ? String(resultObj.transcript).trim() : '';

    return {
      success: true,
      transcript,
      language: languageCode,
      confidence: typeof resultObj?.confidence === 'number' ? resultObj.confidence : 0.90,
      provider: 'google',
      latencyMs
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';

    console.warn(`[Google STT Exception] ${isTimeout ? 'Request Timeout' : err.message}`);
    return {
      success: false,
      transcript: '',
      errorCode: isTimeout ? 'STT_TIMEOUT' : 'STT_EXCEPTION',
      error: isTimeout ? 'STT API request timed out' : err.message,
      provider: 'google',
      latencyMs
    };
  }
}

/**
 * Main Provider-Agnostic Speech-to-Text Entry Point
 *
 * @param {Buffer|string|Object} audioInput - Audio Buffer or Base64 payload
 * @param {Object} [options={}] - Options (provider, languageCode, model, timeoutMs)
 * @returns {Promise<Object>} Normalized transcription response
 */
export async function transcribeAudio(audioInput, options = {}) {
  const config = getSTTConfig();
  const provider = (options.provider || config.provider || 'sarvam').toLowerCase();

  const audioObj = normalizeAudioInput(audioInput);
  if (!audioObj || !audioObj.buffer || audioObj.buffer.length === 0) {
    return {
      success: false,
      transcript: '',
      errorCode: 'INVALID_AUDIO',
      error: 'Audio payload is empty, corrupted, or unsupported format',
      provider,
      latencyMs: 0
    };
  }

  // Security & Credential Check: If API key is missing, return clean failure without throwing
  if (!config.apiKey) {
    return {
      success: false,
      transcript: '',
      errorCode: 'MISSING_STT_API_KEY',
      error: 'STT API key is not configured in environment (STT_API_KEY or SARVAM_API_KEY)',
      provider,
      latencyMs: 0
    };
  }

  if (provider === 'google') {
    return transcribeWithGoogle(audioObj, options, config);
  }

  // Default: Sarvam AI STT
  return transcribeWithSarvam(audioObj, options, config);
}
