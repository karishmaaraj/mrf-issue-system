/**
 * ttsService.js — Text-to-Speech (TTS) Abstraction Layer for MCC FIX HUB
 *
 * Provides a provider-agnostic Text-to-Speech synthesis service (Sarvam AI Bulbul, Azure Neural, Google TTS)
 * for generating spoken audio responses for maintenance workers over telephone calls.
 *
 * STRICT SECURITY CONSTRAINTS:
 * 1. TTS API Keys remain backend-only. Never exposed in API outputs or logs.
 * 2. TTS receives text input ONLY. Receives ZERO student PII, worker PINs, or auth secrets.
 * 3. Text is sanitized for length (<1000 chars) and sensitive pattern stripping before transmission.
 * 4. Safe timeout (default 3000ms via AbortController) & zero ticket state mutation authority.
 */

import { Buffer } from 'buffer';

/**
 * Reads TTS Configuration from environment variables
 */
export function getTTSConfig() {
  const provider = (process.env.TTS_PROVIDER || 'sarvam').toLowerCase();
  const apiKey = process.env.TTS_API_KEY || process.env.SARVAM_API_KEY || process.env.AZURE_TTS_KEY || '';
  const timeoutMs = parseInt(process.env.TTS_TIMEOUT_MS || '3000', 10);
  const defaultLanguage = process.env.TTS_LANGUAGE || 'ta-IN';
  const defaultVoice = process.env.TTS_VOICE || (provider === 'sarvam' ? 'bulbul:v1' : 'ta-IN-ValluvarNeural');
  const sampleRate = parseInt(process.env.TTS_SAMPLE_RATE || '16000', 10);

  return {
    provider,
    apiKey,
    timeoutMs,
    defaultLanguage,
    defaultVoice,
    sampleRate
  };
}

/**
 * Sanitizes input text before transmitting to external TTS providers.
 * Enforces safety limits and redacts accidentally embedded secrets/credentials.
 */
export function sanitizeTTSText(text) {
  if (!text || typeof text !== 'string') return '';

  let clean = text.trim();

  // Redact potential security tokens or credentials if embedded in text string
  clean = clean.replace(/sha256=[a-f0-9]{64}/gi, '[REDACTED_SIG]');
  clean = clean.replace(/[a-f0-9]{32,64}/gi, (match) => {
    // Redact hex strings of typical hash/token lengths if not plain words
    if (match.length >= 32 && !match.includes(' ')) return '[REDACTED_HASH]';
    return match;
  });

  return clean;
}

/**
 * Synthesizes speech using Sarvam AI TTS API (Bulbul model)
 */
async function synthesizeWithSarvam(text, options, config) {
  const startTime = Date.now();
  const url = 'https://api.sarvam.ai/text-to-speech';
  const languageCode = options.language || config.defaultLanguage || 'ta-IN';
  const voice = options.voice || config.defaultVoice || 'bulbul:v1';
  const sampleRate = options.sampleRate || config.sampleRate || 16000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || config.timeoutMs);

  try {
    const payload = {
      inputs: [text],
      target_language_code: languageCode,
      speaker: options.speaker || 'meera',
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      speech_sample_rate: sampleRate,
      enable_preprocessing: true,
      model: voice.includes('v3') ? 'bulbul:v3' : 'bulbul:v1'
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': config.apiKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.warn(`[Sarvam TTS Error] HTTP ${res.status}: ${res.statusText}`);
      return {
        success: false,
        audioBuffer: null,
        errorCode: `HTTP_${res.status}`,
        error: `Sarvam TTS API returned HTTP ${res.status}`,
        provider: 'sarvam',
        latencyMs
      };
    }

    const data = await res.json();
    const rawAudioBase64 = data.audios?.[0] || data.audio || '';

    if (!rawAudioBase64) {
      return {
        success: false,
        audioBuffer: null,
        errorCode: 'EMPTY_AUDIO_RESPONSE',
        error: 'Sarvam TTS API returned empty audio payload',
        provider: 'sarvam',
        latencyMs
      };
    }

    const audioBuffer = Buffer.from(rawAudioBase64, 'base64');

    return {
      success: true,
      audioBuffer,
      mimeType: 'audio/wav',
      audioFormat: 'wav',
      sampleRate,
      language: languageCode,
      voice,
      provider: 'sarvam',
      latencyMs
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';

    console.warn(`[Sarvam TTS Exception] ${isTimeout ? 'Request Timeout' : err.message}`);
    return {
      success: false,
      audioBuffer: null,
      errorCode: isTimeout ? 'TTS_TIMEOUT' : 'TTS_EXCEPTION',
      error: isTimeout ? 'TTS API request timed out' : err.message,
      provider: 'sarvam',
      latencyMs
    };
  }
}

/**
 * Synthesizes speech using Azure Neural Text-to-Speech API
 */
async function synthesizeWithAzure(text, options, config) {
  const startTime = Date.now();
  const region = process.env.AZURE_SPEECH_REGION || 'eastus';
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const languageCode = options.language || config.defaultLanguage || 'ta-IN';
  const voice = options.voice || config.defaultVoice || 'ta-IN-ValluvarNeural';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || config.timeoutMs);

  try {
    const ssml = `<speak version='1.0' xml:lang='${languageCode}'><voice name='${voice}'>${text}</voice></speak>`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm'
      },
      body: ssml,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      console.warn(`[Azure TTS Error] HTTP ${res.status}`);
      return {
        success: false,
        audioBuffer: null,
        errorCode: `HTTP_${res.status}`,
        error: `Azure TTS API returned HTTP ${res.status}`,
        provider: 'azure',
        latencyMs
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    return {
      success: true,
      audioBuffer,
      mimeType: 'audio/wav',
      audioFormat: 'pcm',
      sampleRate: 16000,
      language: languageCode,
      voice,
      provider: 'azure',
      latencyMs
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';

    console.warn(`[Azure TTS Exception] ${isTimeout ? 'Request Timeout' : err.message}`);
    return {
      success: false,
      audioBuffer: null,
      errorCode: isTimeout ? 'TTS_TIMEOUT' : 'TTS_EXCEPTION',
      error: isTimeout ? 'TTS API request timed out' : err.message,
      provider: 'azure',
      latencyMs
    };
  }
}

/**
 * Main Provider-Agnostic Text-to-Speech Entry Point
 *
 * @param {string} textInput - Text string to synthesize into spoken audio
 * @param {Object} [options={}] - Options (provider, language, voice, sampleRate, timeoutMs)
 * @returns {Promise<Object>} Normalized TTS response object
 */
export async function synthesizeSpeech(textInput, options = {}) {
  const config = getTTSConfig();
  const provider = (options.provider || config.provider || 'sarvam').toLowerCase();

  // 1. Text Sanitization & Safety Length Checks
  const text = sanitizeTTSText(textInput);
  if (!text || text.length === 0) {
    return {
      success: false,
      audioBuffer: null,
      errorCode: 'INVALID_TEXT',
      error: 'Text input is empty or invalid',
      provider,
      latencyMs: 0
    };
  }

  if (text.length > 1000) {
    return {
      success: false,
      audioBuffer: null,
      errorCode: 'TEXT_TOO_LONG',
      error: `Text length (${text.length} chars) exceeds maximum allowed 1000 characters limit`,
      provider,
      latencyMs: 0
    };
  }

  // 2. Security Check: Missing API Key Returns Clean Failure (Zero crashes)
  if (!config.apiKey) {
    return {
      success: false,
      audioBuffer: null,
      errorCode: 'MISSING_TTS_API_KEY',
      error: 'TTS API key is not configured in environment (TTS_API_KEY or SARVAM_API_KEY)',
      provider,
      latencyMs: 0
    };
  }

  // 3. Provider Dispatch
  if (provider === 'azure') {
    return synthesizeWithAzure(text, options, config);
  }

  // Default: Sarvam AI TTS
  return synthesizeWithSarvam(text, options, config);
}
