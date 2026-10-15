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
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected,   'hex');
  // Guard: timingSafeEqual requires equal-length buffers; mismatched length → invalid
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Builds the Admin Portal deep-link for a given ticket number.
 * The '#' in ticketNo (e.g. '#001') is URL-encoded as '%23'.
 * @param {string} ticketNo - e.g. '#001'
 * @returns {string} full deep-link URL
 */
function buildAdminDeepLink(ticketNo) {
  const base = (process.env.ADMIN_PORTAL_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!base) return '';
  // Encode '#' as '%23' so the URL parameter is safe
  const encodedTicket = encodeURIComponent(ticketNo);
  return `${base}/admin/?ticket=${encodedTicket}`;
}

/**
 * Sends a WhatsApp notification to the Admin phone for key lifecycle events.
 *
 * Supported eventTypes:
 *   'NEW_COMPLAINT'    — fired when a new ticket is created
 *   'WORKER_ASSIGNED'  — fired when a worker is assigned via PATCH
 *   'REOPENED'         — fired when user rejects resolution (WhatsApp or email flow)
 *   'RESOLVED'         — fired when user confirms resolution (WhatsApp or email flow)
 *
 * Fails gracefully:
 *   - returns early (no throw) if ADMIN_WHATSAPP_PHONE is not configured
 *   - delegates all sending to sendWhatsAppTextMessage (which has its own dry-run logic)
 *   - never exposes secrets, tokens, or PINs
 *
 * @param {object} ticket - the ticket object from tickets.json
 * @param {string} eventType - one of the supported event types above
 * @returns {Promise<object>} result from sendWhatsAppTextMessage, or { success: false } on early exit
 */
export async function sendAdminWhatsAppNotification(ticket, eventType) {
  const adminPhone = (process.env.ADMIN_WHATSAPP_PHONE || '').trim();

  if (!adminPhone) {
    console.log(`[Admin WhatsApp] ADMIN_WHATSAPP_PHONE not configured — skipping ${eventType} notification for ${ticket?.ticketNo}.`);
    return { success: false, skipped: true, reason: 'ADMIN_WHATSAPP_PHONE_NOT_SET' };
  }

  if (!ticket || !ticket.ticketNo) {
    console.warn(`[Admin WhatsApp] Invalid ticket supplied for event ${eventType}. Skipping.`);
    return { success: false, skipped: true, reason: 'INVALID_TICKET' };
  }

  const deepLink = buildAdminDeepLink(ticket.ticketNo);
  const portalLine = deepLink
    ? `\n\n🔗 Open in Admin Portal:\n${deepLink}`
    : '';

  let messageBody = '';

  switch (eventType) {
    case 'NEW_COMPLAINT': {
      const priorityEmoji = ticket.isUrgent || ticket.priority === 'Critical' ? '🔴' : (ticket.priority === 'High' ? '🟠' : '🟡');
      messageBody =
        `🚨 NEW COMPLAINT\n\n` +
        `Ticket: ${ticket.ticketNo}\n` +
        `Category: ${ticket.issueCategory || 'N/A'}\n` +
        `Location: Block ${ticket.block || 'Campus'} / Room ${ticket.roomNo || 'N/A'}\n` +
        `Priority: ${priorityEmoji} ${ticket.priority || 'Normal'}` +
        portalLine;
      break;
    }

    case 'WORKER_ASSIGNED': {
      const workerName = ticket.assignedWorker || 'Unknown Worker';
      messageBody =
        `🎫 ${ticket.ticketNo}\n` +
        `🟡 WORKER ASSIGNED\n\n` +
        `Worker: ${workerName}\n` +
        `Category: ${ticket.issueCategory || 'N/A'}\n` +
        `Location: Block ${ticket.block || 'Campus'} / Room ${ticket.roomNo || 'N/A'}` +
        portalLine;
      break;
    }

    case 'REOPENED': {
      const reopenReason = ticket.rejectionReason || ticket.userRejectionReason || '';
      messageBody =
        `🎫 ${ticket.ticketNo}\n` +
        `🔄 REOPENED\n\n` +
        `The user reported that the issue is not fixed.` +
        (reopenReason ? `\n\nReason: "${reopenReason}"` : '') +
        portalLine;
      break;
    }

    case 'RESOLVED': {
      messageBody =
        `🎫 ${ticket.ticketNo}\n` +
        `🟢 RESOLVED\n\n` +
        `The user confirmed that the issue is fixed.` +
        portalLine;
      break;
    }

    default: {
      console.warn(`[Admin WhatsApp] Unknown eventType "${eventType}". Skipping.`);
      return { success: false, skipped: true, reason: 'UNKNOWN_EVENT_TYPE' };
    }
  }

  try {
    const result = await sendWhatsAppTextMessage(adminPhone, messageBody);
    // HTTP 200 from Meta means the message was accepted for delivery, not yet delivered.
    // Genuine delivery confirmation arrives via a 'statuses' webhook event (status: 'delivered').
    console.log(`[Admin WhatsApp] ${eventType} notification for ${ticket.ticketNo} → accepted by Meta (simulated=${!!result.simulated}): ${result.success ? 'OK' : result.error}`);
    return result;
  } catch (err) {
    // Non-blocking — never propagate to caller
    console.error(`[Admin WhatsApp Error] ${eventType} for ${ticket.ticketNo}:`, err.message);
    return { success: false, error: err.message };
  }
}
