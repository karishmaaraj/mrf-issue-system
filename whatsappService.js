/**
 * whatsappService.js — Meta WhatsApp Cloud API Helper & Utility Service
 * Provides E.164 phone normalization, Graph API HTTP message dispatches,
 * interactive button creation, and webhook signature verification.
 */
import crypto from 'crypto';

/**
 * Normalizes phone numbers to standard E.164 format (e.g. +919840112345)
 * @param {string} phone 
 * @param {string} defaultCountryCode - default '91' for India
 * @returns {string|null} E.164 formatted phone number or null if invalid
 */
export function formatE164(phone, defaultCountryCode = '91') {
  if (!phone || typeof phone !== 'string') return null;
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return null;

  if (cleaned.startsWith('+')) {
    return cleaned.length >= 11 ? cleaned : null;
  }

  cleaned = cleaned.replace(/^0+/, '');

  if (cleaned.length === 10) {
    return `+${defaultCountryCode}${cleaned}`;
  }

  if (cleaned.length === 12 && cleaned.startsWith(defaultCountryCode)) {
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Reads WhatsApp configuration from environment variables
 */
export function getWhatsAppConfig() {
  const enabled = process.env.WHATSAPP_ENABLED !== 'false';
  const token = process.env.WHATSAPP_TOKEN || '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mrf_whatsapp_verify_token_2026';
  const appSecret = process.env.WHATSAPP_APP_SECRET || '';

  const isConfigured = Boolean(
    enabled &&
    token &&
    token !== 'YOUR_WHATSAPP_CLOUD_API_ACCESS_TOKEN' &&
    phoneNumberId &&
    phoneNumberId !== 'YOUR_WHATSAPP_PHONE_NUMBER_ID'
  );

  return {
    enabled,
    isConfigured,
    token,
    phoneNumberId,
    businessAccountId,
    verifyToken,
    appSecret,
    graphUrl: `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`
  };
}

/**
 * Sends a plain text WhatsApp message via Meta Cloud API
 */
export async function sendWhatsAppTextMessage(toPhone, messageBody) {
  const config = getWhatsAppConfig();
  const formattedPhone = formatE164(toPhone);

  if (!formattedPhone) {
    console.warn(`[WhatsApp Service] Invalid phone number provided: "${toPhone}". Skipping WhatsApp dispatch.`);
    return { success: false, error: 'Invalid phone number format', code: 'INVALID_PHONE' };
  }

  if (!config.isConfigured) {
    console.log(`[WhatsApp Service Simulated] To: ${formattedPhone} | Message: ${messageBody.slice(0, 80)}... (API credentials not configured yet)`);
    return { success: true, simulated: true, to: formattedPhone };
  }

  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone.replace('+', ''),
      type: 'text',
      text: {
        preview_url: false,
        body: messageBody
      }
    };

    const response = await fetch(config.graphUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[WhatsApp API Error] HTTP ${response.status}:`, data);
      return { success: false, error: data.error?.message || 'Meta API call failed', details: data };
    }

    console.log(`[WhatsApp API Success] Message sent to ${formattedPhone} (wamid: ${data.messages?.[0]?.id})`);
    return { success: true, messageId: data.messages?.[0]?.id, to: formattedPhone };
  } catch (err) {
    console.error(`[WhatsApp Network Error]`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Sends an Interactive Button WhatsApp message (e.g. Confirm Fixed / Not Fixed)
 */
export async function sendWhatsAppInteractiveButtons(toPhone, bodyText, buttons = []) {
  const config = getWhatsAppConfig();
  const formattedPhone = formatE164(toPhone);

  if (!formattedPhone) {
    console.warn(`[WhatsApp Service] Invalid phone number provided: "${toPhone}". Skipping interactive dispatch.`);
    return { success: false, error: 'Invalid phone number format', code: 'INVALID_PHONE' };
  }

  if (!config.isConfigured) {
    console.log(`[WhatsApp Service Simulated Interactive] To: ${formattedPhone} | Buttons: ${buttons.map(b => b.title).join(', ')}`);
    return { success: true, simulated: true, to: formattedPhone };
  }

  try {
    const actionButtons = buttons.slice(0, 3).map(btn => ({
      type: 'reply',
      reply: {
        id: btn.id,
        title: btn.title.slice(0, 20) // Meta max title length 20 chars
      }
    }));

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone.replace('+', ''),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText
        },
        action: {
          buttons: actionButtons
        }
      }
    };

    const response = await fetch(config.graphUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[WhatsApp API Interactive Error] HTTP ${response.status}:`, data);
      return { success: false, error: data.error?.message || 'Meta Interactive API call failed', details: data };
    }

    console.log(`[WhatsApp Interactive Success] Interactive message sent to ${formattedPhone} (wamid: ${data.messages?.[0]?.id})`);
    return { success: true, messageId: data.messages?.[0]?.id, to: formattedPhone };
  } catch (err) {
    console.error(`[WhatsApp Interactive Network Error]`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Validates HMAC SHA256 signature from Meta webhook requests
 */
export function verifyWebhookSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret) return false;
  const signature = signatureHeader.replace('sha256=', '');
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
