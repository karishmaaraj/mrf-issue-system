/**
 * emailService.js — EmailJS integration for Admin Portal
 */
import emailjs from '@emailjs/browser';

const SERVICE_ID  = 'YOUR_SERVICE_ID';
const TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';

export async function sendCompletionEmail({ to_email, to_name, ticket_no }) {
  if (
    SERVICE_ID === 'YOUR_SERVICE_ID' ||
    TEMPLATE_ID === 'YOUR_TEMPLATE_ID' ||
    PUBLIC_KEY === 'YOUR_PUBLIC_KEY'
  ) {
    console.warn('[EmailJS] Credentials placeholder set. Email skipped for', to_email);
    return;
  }

  const templateParams = {
    to_email,
    to_name,
    ticket_no,
    message: `Your maintenance request ${ticket_no} has been resolved. Thank you for your patience!`,
  };

  try {
    const result = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
    console.log('[EmailJS] Email sent successfully:', result.status, result.text);
  } catch (error) {
    console.error('[EmailJS] Failed to send email:', error);
  }
}

export async function sendWorkerAssignmentEmail({ worker_name, worker_email, ticket_no, issueCategory, location, description }) {
  if (
    SERVICE_ID === 'YOUR_SERVICE_ID' ||
    TEMPLATE_ID === 'YOUR_TEMPLATE_ID' ||
    PUBLIC_KEY === 'YOUR_PUBLIC_KEY'
  ) {
    console.warn('[EmailJS] Worker email dispatch skipped (credentials placeholder). Worker:', worker_name, 'Ticket:', ticket_no);
    return;
  }

  const templateParams = {
    to_name: worker_name,
    to_email: worker_email || `${worker_name.toLowerCase().replace(/\s+/g, '.')}@mrf.edu`,
    ticket_no,
    message: `New Work Order Dispatched: Ticket ${ticket_no} [${issueCategory}] at ${location}. Details: ${description}`,
  };

  try {
    const result = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
    console.log('[EmailJS] Worker email sent:', result.status);
  } catch (error) {
    console.error('[EmailJS] Failed to send worker email:', error);
  }
}
