/**
 * emailService.js — EmailJS integration
 *
 * Called when a ticket is marked "Completed" to notify
 * the submitter that their issue has been resolved.
 *
 * ⚠️  Replace placeholder constants with your real EmailJS credentials:
 *   1. Go to https://www.emailjs.com/ and create a free account
 *   2. Create a Service (e.g. Gmail) → note the Service ID
 *   3. Create an Email Template with variables: {{to_name}}, {{ticket_no}}, {{message}}
 *   4. Copy your Public Key from Account → API Keys
 */
import emailjs from '@emailjs/browser';

// ─── Replace these with your real EmailJS credentials ─────────
const SERVICE_ID  = 'YOUR_SERVICE_ID';
const TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';
// ──────────────────────────────────────────────────────────────

/**
 * Sends a completion notification email via EmailJS.
 *
 * @param {{ to_email: string, to_name: string, ticket_no: string }} params
 * @returns {Promise<void>}
 */
export async function sendCompletionEmail({ to_email, to_name, ticket_no }) {
  // Guard: skip if credentials are still placeholders
  if (
    SERVICE_ID === 'YOUR_SERVICE_ID' ||
    TEMPLATE_ID === 'YOUR_TEMPLATE_ID' ||
    PUBLIC_KEY === 'YOUR_PUBLIC_KEY'
  ) {
    console.warn(
      '[EmailJS] Credentials not configured. Skipping email to',
      to_email
    );
    return;
  }

  const templateParams = {
    to_email,
    to_name,
    ticket_no,
    message: `Your maintenance request ${ticket_no} has been resolved. Thank you for your patience!`,
  };

  try {
    const result = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      templateParams,
      PUBLIC_KEY
    );
    console.log('[EmailJS] Email sent successfully:', result.status, result.text);
  } catch (error) {
    console.error('[EmailJS] Failed to send email:', error);
  }
}

/**
 * Sends a work assignment notification email to the assigned worker.
 */
export async function sendWorkerAssignmentEmail({ worker_name, worker_email, ticket_no, issueCategory, location, description }) {
  if (
    SERVICE_ID === 'YOUR_SERVICE_ID' ||
    TEMPLATE_ID === 'YOUR_TEMPLATE_ID' ||
    PUBLIC_KEY === 'YOUR_PUBLIC_KEY'
  ) {
    console.warn('[EmailJS] Worker notification skipped (credentials placeholder). Worker:', worker_name, 'Ticket:', ticket_no);
    return;
  }

  const templateParams = {
    to_name: worker_name,
    to_email: worker_email || `${worker_name.toLowerCase().replace(/\s+/g, '.')}@mrf.edu`,
    ticket_no,
    message: `New Work Order Dispatched: Ticket ${ticket_no} [${issueCategory}] at ${location}. Description: ${description}`,
  };

  try {
    const result = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      templateParams,
      PUBLIC_KEY
    );
    console.log('[EmailJS] Worker email sent:', result.status);
  } catch (error) {
    console.error('[EmailJS] Failed to send worker email:', error);
  }
}
