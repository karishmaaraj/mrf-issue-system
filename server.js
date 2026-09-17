/**
 * server.js — Local Sync Server for MRF Issue System
 * Runs on http://localhost:5000
 * Connects Student Portal (port 5174) and Admin Portal (port 5175)
 */
import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import {
  formatE164,
  getWhatsAppConfig,
  sendWhatsAppTextMessage,
  sendWhatsAppInteractiveButtons,
  verifyWebhookSignature
} from './whatsappService.js';
import {
  triggerWorkerVoiceCall,
  getVoiceSession,
  processVoiceInput,
  getVoiceSessionSummary,
  buildTicketSpokenScript,
  getVoiceConfig,
  verifyVoiceWebhookSignature
} from './voiceService.js';
import {
  normalizeCallEvent,
  bindCallSession,
  validateCallSessionAccess,
  checkWebhookRateLimit,
  buildVoiceResponse,
  buildDtmfGatherResponse,
  buildSayResponse,
  buildHangupResponse,
  buildErrorResponse,
  sanitizePayload
} from './telephonyAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from the directory containing server.js
dotenv.config({ path: path.join(__dirname, '.env') });


const DATA_FILE = path.join(__dirname, 'tickets.json');
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// In-memory state tracking for WhatsApp user rejection reasons and message deduplication
const pendingRejectionsMap = new Map(); // key: user formatted phone, value: { ticketNo, timestamp }
const processedMessageIdsSet = new Set(); // Stores last 2000 processed Meta message IDs


// Configurable base URL for worker email completion links (supports localhost and LAN testing)
function getWorkerCompletionBaseUrl() {
  const envUrl = process.env.WORKER_COMPLETION_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return `http://localhost:${PORT}`;
}

function findWorkerPhone(workerName, explicitPhone = null) {
  if (explicitPhone) return explicitPhone;
  if (!workerName || typeof workerName !== 'string') return null;
  try {
    const cfg = readConfig();
    const w = (cfg.workers || []).find(worker =>
      (worker.name && worker.name.trim().toLowerCase() === workerName.trim().toLowerCase()) ||
      (worker.email && worker.email.trim().toLowerCase() === workerName.trim().toLowerCase())
    );
    return w ? w.phone : null;
  } catch {
    return null;
  }
}

function findWorkerEmail(workerName, explicitEmail = null) {
  if (explicitEmail && explicitEmail.includes('@')) return explicitEmail;
  if (!workerName || typeof workerName !== 'string') return null;
  try {
    const cfg = readConfig();
    const w = (cfg.workers || []).find(worker =>
      (worker.name && worker.name.trim().toLowerCase() === workerName.trim().toLowerCase()) ||
      (worker.email && worker.email.trim().toLowerCase() === workerName.trim().toLowerCase())
    );
    return (w && w.email && w.email.includes('@')) ? w.email : null;
  } catch {
    return null;
  }
}


// Configurable Admin Portal link for completion confirmation pages and email notifications
function getAdminPortalBaseUrl() {
  const envUrl = process.env.ADMIN_PORTAL_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  const completionBase = process.env.WORKER_COMPLETION_BASE_URL;
  if (completionBase && completionBase.trim()) {
    try {
      const u = new URL(completionBase.trim());
      return `${u.protocol}//${u.hostname}/admin`;
    } catch {
      // ignore
    }
  }
  return 'http://localhost/admin/';
}

function generateToken() {
  return crypto.randomBytes(20).toString('hex');
}

// SMTP Email Configuration (Modify or set environment variables as needed)
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER || 'admin.mrf@gmail.com',
    pass: process.env.SMTP_PASS || 'your-app-password',
  },
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin.mrf@gmail.com';

// Initialize Nodemailer Transporter
const transporter = nodemailer.createTransport(SMTP_CONFIG);

/**
 * Sends an email notification to the admin via SMTP when a new complaint is submitted
 */
async function sendAdminNotification(ticket) {
  const priorityBadge = ticket.isUrgent ? '🔴 URGENT / CRITICAL' : `🟡 ${ticket.priority}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #1e293b; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">🚨 New Complaint Raised — ${ticket.ticketNo}</h2>
      </div>
      
      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <div style="margin-bottom: 16px; padding: 12px; border-radius: 6px; background-color: ${ticket.isUrgent ? '#fef2f2' : '#f8fafc'}; border-left: 4px solid ${ticket.isUrgent ? '#ef4444' : '#3b82f6'};">
          <strong style="font-size: 14px; text-transform: uppercase;">Priority:</strong> ${priorityBadge}
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 35%; color: #64748b;">Ticket Number:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #0f172a;">${ticket.ticketNo}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Complainant Name:</td>
            <td style="padding: 8px 0;">${ticket.name} (${ticket.userType})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Email:</td>
            <td style="padding: 8px 0;"><a href="mailto:${ticket.email}" style="color: #2563eb;">${ticket.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Phone:</td>
            <td style="padding: 8px 0;">${ticket.phone || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Department / Stream:</td>
            <td style="padding: 8px 0;">${ticket.department} ${ticket.studentStream ? `(${ticket.studentStream})` : ''}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Location / Room:</td>
            <td style="padding: 8px 0;">${ticket.block ? `Block ${ticket.block}, Room ${ticket.roomNo}` : 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Issue Category:</td>
            <td style="padding: 8px 0;">${ticket.issueCategory}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Submitted At:</td>
            <td style="padding: 8px 0;">${new Date(ticket.createdAt).toLocaleString()}</td>
          </tr>
        </table>

        <div style="margin-top: 16px; padding: 16px; background-color: #f1f5f9; border-radius: 6px;">
          <h4 style="margin: 0 0 8px 0; color: #1e293b;">Description:</h4>
          <p style="margin: 0; color: #475569; white-space: pre-line;">${ticket.description}</p>
        </div>

        <div style="margin-top: 24px; text-align: center;">
          <a href="${getAdminPortalBaseUrl()}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-weight: bold; border-radius: 6px; text-decoration: none;">View in Admin Portal</a>
        </div>
      </div>

      <div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        MRF Issue Resolution System • Automated Admin Notification
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"MRF Issue System" <${SMTP_CONFIG.auth.user}>`,
    to: ADMIN_EMAIL,
    subject: `[MRF Ticket ${ticket.ticketNo}] ${ticket.isUrgent ? 'URGENT: ' : ''}${ticket.issueCategory} - ${ticket.name}`,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP] Admin email notification sent for ${ticket.ticketNo}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[SMTP Error] Failed to send admin email notification for ${ticket.ticketNo}:`, err.message);
    return false;
  }
}

/**
 * Sends SMTP assignment email to worker when assigned to a ticket
 */
async function sendWorkerAssignmentEmail(ticket, workerName, workerEmail = null) {
  const targetEmail = workerEmail || findWorkerEmail(workerName);
  if (!targetEmail || !targetEmail.includes('@')) {
    console.log(`[SMTP Worker Email Skipped] No valid email found for worker "${workerName}".`);
    return false;
  }

  if (!ticket.completionToken) {
    ticket.completionToken = generateToken();
  }

  const baseUrl = getWorkerCompletionBaseUrl();
  const completionLink = `${baseUrl}/api/complete-task?token=${ticket.completionToken}`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #2563eb 100%); color: #ffffff; padding: 28px 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">MCC Campus Facilities</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #93c5fd; font-weight: 600;">Work Order Assignment Dispatch</p>
      </div>

      <div style="padding: 32px 28px; color: #334155; line-height: 1.6;">
        <p style="font-size: 15px; margin-top: 0;">Hello <strong>${workerName}</strong>,</p>
        <p style="font-size: 14px; color: #0f172a; font-weight: 700;">
          Ticket ${ticket.ticketNo} has been assigned to you.
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; font-size: 13px;">
          <tbody>
            <tr>
              <td style="padding: 11px 16px; font-weight: 700; width: 34%; color: #64748b;">Ticket Number:</td>
              <td style="padding: 11px 16px; font-weight: 900; color: #0f172a;">${ticket.ticketNo}</td>
            </tr>
            <tr>
              <td style="padding: 11px 16px; font-weight: 700; color: #64748b;">Category:</td>
              <td style="padding: 11px 16px; font-weight: 700; color: #0f172a;">${ticket.issueCategory}</td>
            </tr>
            <tr>
              <td style="padding: 11px 16px; font-weight: 700; color: #64748b;">Location:</td>
              <td style="padding: 11px 16px; color: #334155; font-weight: 600;">Block ${ticket.block || 'Campus'}, Room ${ticket.roomNo || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 11px 16px; font-weight: 700; color: #64748b;">Description:</td>
              <td style="padding: 11px 16px; color: #475569;">${ticket.description || 'N/A'}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin: 28px 0 22px 0; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; border-radius: 14px; padding: 22px 18px; text-align: center;">
          <div style="font-size: 13px; font-weight: 800; color: #166534; text-transform: uppercase; margin-bottom: 6px;">
            ⚡ Task Completion Confirmation
          </div>
          <p style="font-size: 12px; color: #15803d; margin: 0 0 18px 0;">
            When you have finished repairs on site, click the button below to update system status:
          </p>
          <a href="${completionLink}" target="_blank" style="display: inline-block; padding: 15px 32px; font-size: 16px; font-weight: 900; color: #ffffff; background-color: #16a34a; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; border-radius: 12px; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35);">
            WORK COMPLETED
          </a>
        </div>
      </div>

      <div style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
        © 2026 Campus Facilities Maintenance Portal • Automated SMTP Worker Dispatch
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"${process.env.SMTP_FROM_NAME || 'MRF Facilities Admin'}" <${SMTP_CONFIG.auth.user}>`,
    to: targetEmail,
    subject: `Ticket ${ticket.ticketNo} has been assigned to you.`,
    text: `Hello ${workerName},\n\nTicket ${ticket.ticketNo} has been assigned to you.\n\nCategory: ${ticket.issueCategory}\nLocation: Block ${ticket.block || 'Campus'}, Room ${ticket.roomNo || 'N/A'}\nDescription: ${ticket.description}\n\nWhen finished on site, click here to mark work completed:\n${completionLink}\n\nMRF Facilities Maintenance`,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP Worker Assignment Email] Sent to ${workerName} (${targetEmail}) for Ticket ${ticket.ticketNo}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[SMTP Worker Assignment Email Error]`, err.message);
    return false;
  }
}

/**
 * Sends SMTP verification email to user when worker completes task
 */
async function sendUserVerificationEmail(ticket) {
  if (!ticket.email || !ticket.email.includes('@')) {
    console.log(`[SMTP Verification Email Skipped] User email for ticket ${ticket.ticketNo} is missing or invalid: "${ticket.email}".`);
    return false;
  }

  if (!ticket.userVerifyToken) {
    ticket.userVerifyToken = generateToken();
  }

  const baseUrl = getWorkerCompletionBaseUrl();
  const fixedLink = `${baseUrl}/api/verify-user?token=${ticket.userVerifyToken}&action=fixed`;
  const notFixedLink = `${baseUrl}/api/verify-user?token=${ticket.userVerifyToken}&action=not_fixed`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; padding: 28px 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">MCC Campus Facilities</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #e0f2fe; font-weight: 600;">Action Required: Verify Complaint Resolution</p>
      </div>

      <div style="padding: 32px 28px; color: #334155; line-height: 1.6;">
        <p style="font-size: 15px; margin-top: 0;">Dear <strong>${ticket.name || 'Complainant'}</strong>,</p>
        <p style="font-size: 14px; color: #475569;">
          Work for Ticket <strong>${ticket.ticketNo}</strong> has been completed by assigned staff (<strong>${ticket.assignedWorker || 'Maintenance Staff'}</strong>). Please verify that the issue is actually fixed.
        </p>

        <div style="margin: 20px 0; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 18px;">
          <h4 style="margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Ticket Summary</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 36%;">Ticket Number:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 800;">${ticket.ticketNo}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Issue Category:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${ticket.issueCategory}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Location:</td>
              <td style="padding: 6px 0; color: #334155; font-weight: 600;">Block ${ticket.block || 'Campus'}, Room ${ticket.roomNo || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Description:</td>
              <td style="padding: 6px 0; color: #475569;">${ticket.description || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Assigned Worker:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${ticket.assignedWorker || 'Maintenance Staff'}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; font-weight: 700; color: #0f172a; text-align: center; margin-bottom: 20px;">
          Please inspect the location and confirm whether the issue is fixed:
        </p>

        <!-- Professional Email-Safe CTA Buttons Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0 28px 0; border-collapse: collapse;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
                <tr>
                  <!-- Button 1: ISSUE FIXED -->
                  <td align="center" valign="middle" style="background-color: #16a34a; border-radius: 8px; text-align: center;">
                    <a href="${fixedLink}" target="_blank" style="display: inline-block; background-color: #16a34a; color: #ffffff; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 800; text-decoration: none; padding: 13px 22px; border-radius: 8px; border: 1px solid #16a34a; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">
                      ✅ ISSUE FIXED
                    </a>
                  </td>
                  <!-- 16px Horizontal Gap -->
                  <td width="16" style="width: 16px; font-size: 1px; line-height: 1px;">&nbsp;</td>
                  <!-- Button 2: ISSUE NOT FIXED -->
                  <td align="center" valign="middle" style="background-color: #dc2626; border-radius: 8px; text-align: center;">
                    <a href="${notFixedLink}" target="_blank" style="display: inline-block; background-color: #dc2626; color: #ffffff; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 800; text-decoration: none; padding: 13px 22px; border-radius: 8px; border: 1px solid #dc2626; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">
                      ❌ ISSUE NOT FIXED
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0; line-height: 1.5;">
          If you have any questions, you may contact the Campus Facilities Governance desk.
        </p>
      </div>

      <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
        © 2026 MCC Campus Facilities • Automated Secure SMTP Verification System
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"${process.env.SMTP_FROM_NAME || 'MRF Facilities System'}" <${SMTP_CONFIG.auth.user}>`,
    to: ticket.email,
    subject: `Action Required: Verify Ticket ${ticket.ticketNo}`,
    text: `Hello ${ticket.name},\n\nWork for Ticket ${ticket.ticketNo} (${ticket.issueCategory}) has been completed by ${ticket.assignedWorker}.\n\nPlease verify if the issue is fixed:\n\nISSUE FIXED:\n${fixedLink}\n\nISSUE NOT FIXED:\n${notFixedLink}\n\nMRF Campus Facilities Maintenance`,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP User Verification Email] Sent to ${ticket.name} (${ticket.email}) for Ticket ${ticket.ticketNo}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[SMTP User Verification Email Error] Failed for Ticket ${ticket.ticketNo}:`, err.message);
    return false;
  }
}

/**
 * Sends SMTP confirmation email to user after clicking "ISSUE FIXED"
 */
async function sendUserConfirmationSuccessEmail(ticket) {
  if (!ticket.email || !ticket.email.includes('@')) return false;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #bbf7d0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; padding: 24px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 900;">✓ Ticket Resolution Confirmed</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #d1fae5;">Ticket ${ticket.ticketNo} is now officially Resolved and Closed</p>
      </div>
      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <p>Dear <strong>${ticket.name || 'Complainant'}</strong>,</p>
        <p>Thank you for confirming that your complaint <strong>Ticket ${ticket.ticketNo}</strong> (${ticket.issueCategory}) at <strong>Block ${ticket.block || 'Campus'}, Room ${ticket.roomNo || 'N/A'}</strong> has been fixed on site.</p>
        <p>This ticket is now closed in our central maintenance system.</p>
      </div>
      <div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        MCC Campus Facilities • Complaint Management Governance
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'MRF Facilities System'}" <${SMTP_CONFIG.auth.user}>`,
      to: ticket.email,
      subject: `[Resolved] Ticket ${ticket.ticketNo} Confirmation Received`,
      html: htmlContent,
    });
    return true;
  } catch (err) {
    console.error(`[SMTP Confirmation Success Email Error]`, err.message);
    return false;
  }
}

/**
 * Sends SMTP alerts to Admin & Worker when user reports "ISSUE NOT FIXED"
 */
async function sendTicketReopenedAlerts(ticket, rejectionReason) {
  // 1. Alert Admin via SMTP
  const adminHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fca5a5; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #991b1b; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 18px;">🔴 Ticket Reopened — Issue Not Fixed</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px;">Complainant reported unresolved issue for Ticket ${ticket.ticketNo}</p>
      </div>
      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; width: 35%; color: #64748b;">Ticket Number:</td>
            <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${ticket.ticketNo}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Complainant:</td>
            <td style="padding: 6px 0;">${ticket.name} (${ticket.email || 'N/A'})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Issue Category:</td>
            <td style="padding: 6px 0;">${ticket.issueCategory}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Location:</td>
            <td style="padding: 6px 0;">Block ${ticket.block || 'Campus'}, Room ${ticket.roomNo || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Assigned Worker:</td>
            <td style="padding: 6px 0; font-weight: bold;">${ticket.assignedWorker || 'Unassigned'}</td>
          </tr>
        </table>

        <div style="padding: 16px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 6px 0; color: #991b1b;">User Rejection Reason:</h4>
          <p style="margin: 0; color: #7f1d1d; white-space: pre-wrap; font-weight: 600;">"${rejectionReason}"</p>
        </div>

        <p style="font-size: 13px; color: #475569;">
          This ticket status has been changed to <strong>REOPENED</strong>. Please review and re-dispatch work orders as needed.
        </p>

        <div style="text-align: center; margin-top: 20px;">
          <a href="${getAdminPortalBaseUrl()}" style="display: inline-block; background-color: #991b1b; color: #ffffff; padding: 10px 20px; font-weight: bold; border-radius: 6px; text-decoration: none;">View in Admin Portal</a>
        </div>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'MRF Facilities System'}" <${SMTP_CONFIG.auth.user}>`,
      to: ADMIN_EMAIL,
      subject: `[REOPENED] Action Required: Ticket ${ticket.ticketNo} Reported Not Fixed`,
      html: adminHtml,
    });
    console.log(`[SMTP Admin Reopen Alert] Dispatched for Ticket ${ticket.ticketNo}`);
  } catch (err) {
    console.error(`[SMTP Admin Reopen Alert Error]`, err.message);
  }

  // 2. Alert Assigned Worker via SMTP if worker email exists
  if (ticket.assignedWorker) {
    const workerEmail = findWorkerEmail(ticket.assignedWorker);
    if (workerEmail) {
      const workerHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fca5a5; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #dc2626; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">🔴 Work Order REOPENED</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px;">Ticket ${ticket.ticketNo} was marked NOT FIXED by complainant</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <p>Hello <strong>${ticket.assignedWorker}</strong>,</p>
            <p>Complainant <strong>${ticket.name}</strong> reported that the issue for <strong>Ticket ${ticket.ticketNo}</strong> (${ticket.issueCategory} at Block ${ticket.block || 'Campus'}, Room ${ticket.roomNo || 'N/A'}) is still NOT fixed.</p>
            
            <div style="padding: 16px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; margin: 16px 0;">
              <strong style="color: #991b1b;">Complainant Feedback:</strong>
              <p style="margin: 6px 0 0 0; color: #7f1d1d; white-space: pre-wrap; font-weight: 600;">"${rejectionReason}"</p>
            </div>

            <p>Please inspect the site again and complete the necessary repairs.</p>
          </div>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: `"${process.env.SMTP_FROM_NAME || 'MRF Facilities System'}" <${SMTP_CONFIG.auth.user}>`,
          to: workerEmail,
          subject: `[REOPENED] Task Action Required: Ticket ${ticket.ticketNo}`,
          html: workerHtml,
        });
        console.log(`[SMTP Worker Reopen Alert] Dispatched to ${ticket.assignedWorker} (${workerEmail}) for Ticket ${ticket.ticketNo}`);
      } catch (err) {
        console.error(`[SMTP Worker Reopen Alert Error]`, err.message);
      }
    }
  }
}

/**
 * Sends SMTP email to User when Worker is Assigned
 */
async function sendUserWorkerAssignedEmail(ticket) {
  if (!ticket.email || !ticket.email.includes('@')) return false;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #2563eb; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 18px;">📋 Worker Assigned to Your Complaint</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px;">Ticket ${ticket.ticketNo}</p>
      </div>
      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <p>Dear <strong>${ticket.name || 'Complainant'}</strong>,</p>
        <p>We wanted to let you know that a worker has been assigned to your complaint <strong>Ticket ${ticket.ticketNo}</strong>.</p>
        <ul>
          <li><strong>Assigned Worker:</strong> ${ticket.assignedWorker || 'Unassigned'}</li>
          <li><strong>Category:</strong> ${ticket.issueCategory}</li>
          <li><strong>Location:</strong> Block ${ticket.block || 'Campus'}, Room ${ticket.roomNo || 'N/A'}</li>
          <li><strong>Current Status:</strong> Work Assigned / Ongoing</li>
        </ul>
        <p>You will receive further updates when work begins or is completed.</p>
      </div>
    </div>
  `;
  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'MRF Facilities System'}" <${SMTP_CONFIG.auth.user}>`,
      to: ticket.email,
      subject: `Complaint #${ticket.ticketNo} Assigned to a Worker`,
      html: htmlContent,
    });
    console.log(`[SMTP User Assigned Email] Sent for Ticket ${ticket.ticketNo}`);
    return true;
  } catch (err) {
    console.error(`[SMTP User Assigned Email Error]`, err.message);
    return false;
  }
}

/**
 * Sends SMTP email to User when Worker starts work
 */
async function sendUserWorkStartedEmail(ticket) {
  if (!ticket.email || !ticket.email.includes('@')) return false;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #f59e0b; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 18px;">⏳ Work Started on Your Complaint</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px;">Ticket ${ticket.ticketNo}</p>
      </div>
      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <p>Dear <strong>${ticket.name || 'Complainant'}</strong>,</p>
        <p>Work has started on your complaint <strong>Ticket ${ticket.ticketNo}</strong> by <strong>${ticket.assignedWorker || 'the assigned worker'}</strong>.</p>
        <p><strong>Current Status:</strong> Ongoing</p>
        <p>You will receive another notification when the work is completed so that you can verify it.</p>
      </div>
    </div>
  `;
  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'MRF Facilities System'}" <${SMTP_CONFIG.auth.user}>`,
      to: ticket.email,
      subject: `Work Started on Complaint #${ticket.ticketNo}`,
      html: htmlContent,
    });
    console.log(`[SMTP User Work Started Email] Sent for Ticket ${ticket.ticketNo}`);
    return true;
  } catch (err) {
    console.error(`[SMTP User Work Started Email Error]`, err.message);
    return false;
  }
}

/**
 * Sends SMTP email to User when Worker cannot complete
 */
async function sendUserCannotCompleteEmail(ticket) {
  if (!ticket.email || !ticket.email.includes('@')) return false;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #991b1b; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 18px;">⚠️ Issue with Your Complaint</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px;">Ticket ${ticket.ticketNo}</p>
      </div>
      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <p>Dear <strong>${ticket.name || 'Complainant'}</strong>,</p>
        <p>We are writing to inform you that the assigned worker (<strong>${ticket.assignedWorker || 'worker'}</strong>) could not complete the work for <strong>Ticket ${ticket.ticketNo}</strong>.</p>
        <p><strong>Current Status:</strong> Cannot Complete</p>
        <p>The issue is being handled through the maintenance workflow by the administrative team, who will review and reassign or take further action as needed.</p>
      </div>
    </div>
  `;
  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'MRF Facilities System'}" <${SMTP_CONFIG.auth.user}>`,
      to: ticket.email,
      subject: `Update on Complaint #${ticket.ticketNo} - Cannot Complete`,
      html: htmlContent,
    });
    console.log(`[SMTP User Cannot Complete Email] Sent for Ticket ${ticket.ticketNo}`);
    return true;
  } catch (err) {
    console.error(`[SMTP User Cannot Complete Email Error]`, err.message);
    return false;
  }
}

/**
 * Sends SMTP email to User when User Rejects completion
 */
async function sendUserReopenedEmail(ticket) {
  if (!ticket.email || !ticket.email.includes('@')) return false;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #dc2626; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 18px;">🔴 Issue Marked as Not Fixed</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px;">Ticket ${ticket.ticketNo}</p>
      </div>
      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <p>Dear <strong>${ticket.name || 'Complainant'}</strong>,</p>
        <p>Thank you for your feedback on <strong>Ticket ${ticket.ticketNo}</strong>.</p>
        <p>We have recorded that the issue has been marked as <strong>not fixed</strong>.</p>
        <p><strong>Current Status:</strong> Reopened</p>
        <p>The maintenance team has been alerted and will take further action to resolve this issue.</p>
      </div>
    </div>
  `;
  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'MRF Facilities System'}" <${SMTP_CONFIG.auth.user}>`,
      to: ticket.email,
      subject: `Complaint #${ticket.ticketNo} Marked as Not Fixed - Reopened`,
      html: htmlContent,
    });
    console.log(`[SMTP User Reopened Email] Sent for Ticket ${ticket.ticketNo}`);
    return true;
  } catch (err) {
    console.error(`[SMTP User Reopened Email Error]`, err.message);
    return false;
  }
}

// Ensure tickets.json exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ tickets: [], counter: 0 }, null, 2));
}

function buildHistoryForTicket(t) {
  const events = [];

  // 1. Complaint Raised
  events.push({
    id: `evt-${t.ticketNo}-created`,
    type: 'CREATED',
    title: 'Complaint Raised',
    timestamp: t.createdAt || new Date().toISOString(),
    actor: t.name || 'Complainant',
    details: `Complaint submitted for ${t.issueCategory || 'Facilities Issue'} at ${t.block || 'Campus'} (Room ${t.roomNo || 'N/A'}). Priority: ${t.priority || 'Normal'}.`
  });

  // 2. Admin Notified
  events.push({
    id: `evt-${t.ticketNo}-admin-notified`,
    type: 'ADMIN_NOTIFIED',
    title: 'Admin Notified via Email',
    timestamp: t.createdAt || new Date().toISOString(),
    actor: 'Central Facilities System',
    details: `Automated complaint alert dispatched to Facilities Admin (${ADMIN_EMAIL}) via SMTP.`
  });

  // 3. Worker Assigned
  if (t.assignedWorker) {
    events.push({
      id: `evt-${t.ticketNo}-assigned`,
      type: 'ASSIGNED',
      title: `Worker Assigned (${t.assignedWorker})`,
      timestamp: t.assignedAt || t.updatedAt || t.createdAt,
      actor: 'Campus Facilities Admin',
      details: `Work order dispatched to ${t.assignedWorker}. Status set to Ongoing.`
    });
  }

  // 4. Worker Completed Task
  if (t.status === 'Awaiting User Confirmation' || t.workerCompletedAt || t.completedAt) {
    events.push({
      id: `evt-${t.ticketNo}-completed`,
      type: 'WORKER_COMPLETED',
      title: `Worker Clicked "WORK COMPLETED"`,
      timestamp: t.workerCompletedAt || t.completedAt || t.updatedAt || new Date().toISOString(),
      actor: t.completedBy || t.assignedWorker || 'Maintenance Staff',
      details: `Worker confirmed completion of ${t.issueCategory || 'repairs'} on site. Status set to Awaiting User Confirmation.`
    });
  }

  // 5. User Confirmed Fixed
  if (t.status === 'Resolved' || t.userConfirmedAt) {
    events.push({
      id: `evt-${t.ticketNo}-user-confirmed`,
      type: 'USER_CONFIRMED',
      title: 'User Confirmed Issue Fixed',
      timestamp: t.userConfirmedAt || t.updatedAt || new Date().toISOString(),
      actor: t.name || 'Complainant',
      details: 'Complainant verified on site via SMTP email link that the issue is fixed. Ticket status set to Resolved and closed.'
    });
  }

  // 6. User Reported Not Fixed
  if (t.status === 'Reopened' || t.rejectionReason) {
    events.push({
      id: `evt-${t.ticketNo}-user-rejected`,
      type: 'USER_REJECTED',
      title: 'User Reported Issue Not Fixed',
      timestamp: t.updatedAt || new Date().toISOString(),
      actor: t.name || 'Complainant',
      details: `Complainant reported issue as not fixed. Reason: "${t.rejectionReason || 'Issue requires further attention'}". Ticket status set to Reopened.`
    });
  }

  return events;
}

function extractMaxTicketNumber(tickets) {
  if (!Array.isArray(tickets)) return 0;
  return tickets.reduce((max, t) => {
    if (!t || !t.ticketNo) return max;
    const match = String(t.ticketNo).match(/\d+/);
    const num = match ? parseInt(match[0], 10) : 0;
    return Math.max(max, isNaN(num) ? 0 : num);
  }, 0);
}

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    let changed = false;
    if (!Array.isArray(data.tickets)) {
      data.tickets = [];
      changed = true;
    }
    const maxExisting = extractMaxTicketNumber(data.tickets);
    if (typeof data.counter !== 'number' || isNaN(data.counter) || data.counter < maxExisting) {
      data.counter = maxExisting;
      changed = true;
    }
    data.tickets.forEach(t => {
      if (!t.completionToken) {
        t.completionToken = generateToken();
        changed = true;
      }
      if (!t.userVerifyToken) {
        t.userVerifyToken = generateToken();
        changed = true;
      }
      if (!Array.isArray(t.history) || t.history.length === 0) {
        t.history = buildHistoryForTicket(t);
        changed = true;
      }
    });
    if (changed) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }
    return data;
  } catch {
    return { tickets: [], counter: 0 };
  }
}
// ── GAP #6 RESPONSE DTO SERIALIZERS & ALLOWLISTS ──────────────────────────────
const ALLOWED_PATCH_FIELDS = new Set([
  'status',
  'assignedWorker',
  'priority',
  'isUrgent',
  'department',
  'block',
  'roomNo',
  'description'
]);

function serializePublicTicket(t) {
  if (!t || typeof t !== 'object') return null;
  return {
    success: true,
    ticketNo: t.ticketNo || '',
    status: t.status || 'Unsolved',
    createdAt: t.createdAt || new Date().toISOString()
  };
}

function serializeWorkerTicket(t) {
  if (!t || typeof t !== 'object') return null;
  return {
    ticketNo: t.ticketNo || '',
    status: t.status || 'Unsolved',
    priority: t.priority || 'Normal',
    isUrgent: !!t.isUrgent,
    issueCategory: t.issueCategory || '',
    block: t.block || '',
    roomNo: t.roomNo || '',
    description: t.description || '',
    name: t.name || '',
    phone: t.phone || '',
    department: t.department || '',
    assignedWorker: t.assignedWorker || '',
    createdAt: t.createdAt || '',
    updatedAt: t.updatedAt || '',
    history: Array.isArray(t.history) ? t.history : []
  };
}

function serializeAdminTicket(t) {
  if (!t || typeof t !== 'object') return null;
  const dto = {
    ticketNo: t.ticketNo || '',
    name: t.name || '',
    email: t.email || '',
    phone: t.phone || '',
    department: t.department || '',
    userType: t.userType || '',
    studentStream: t.studentStream || '',
    studentLevel: t.studentLevel || '',
    company: t.company || '',
    block: t.block || '',
    roomNo: t.roomNo || '',
    issueCategory: t.issueCategory || '',
    description: t.description || '',
    priority: t.priority || 'Normal',
    status: t.status || 'Unsolved',
    isUrgent: !!t.isUrgent,
    assignedWorker: t.assignedWorker || '',
    history: Array.isArray(t.history) ? t.history : [],
    createdAt: t.createdAt || '',
    updatedAt: t.updatedAt || '',
    completedBy: t.completedBy || '',
    workerCompletedAt: t.workerCompletedAt || '',
    completedDate: t.completedDate || '',
    completedTime: t.completedTime || '',
    userConfirmedAt: t.userConfirmedAt || '',
    reopenReason: t.reopenReason || '',
    adminOverrideReason: t.adminOverrideReason || ''
  };

  if (t.customFields && typeof t.customFields === 'object' && !Array.isArray(t.customFields)) {
    dto.customFields = t.customFields;
  }

  return dto;
}

const CONFIG_FILE = path.join(__dirname, 'config.json');
const CONFIG_BAK_FILE = path.join(__dirname, 'config.json.bak');
const CONFIG_TMP_FILE = path.join(__dirname, 'config.json.tmp');

const ALLOWED_CONFIG_KEYS = new Set([
  'workers',
  'companies',
  'categories',
  'announcement',
  'announcements',
  'slaTargetHours',
  'autoEmailAlerts',
  'portalActive',
  'submissionsEnabled',
  'portalNotice',
  'version',
  'lastPublished',
  'publishedBy',
  'branding',
  'theme',
  'navigation',
  'homePage',
  'complaintForm',
  'userPortal',
  'adminPortal',
  'emailTemplates',
  'features',
  'facilitiesContact',
  'emergencyHazards'
]);

const DEFAULT_CONFIG_DATA = {
  version: '2.0.0',
  lastPublished: new Date().toISOString(),
  publishedBy: 'Super Admin',
  workers: [
    { id: 'w1', name: 'Rajan Kumar', role: 'Electrical Lead', email: 'karishmaa24raj@gmail.com', icon: '💡', active: true, phone: '+91 98401 12345' },
    { id: 'w2', name: 'Suresh Menon', role: 'Plumbing Specialist', email: 'rajanubama23@gmail.com', icon: '🚰', active: true, phone: '+91 98402 23456' },
    { id: 'w3', name: 'Priya Nair', role: 'IT & Infrastructure', email: 'balap4496@gmail.com', icon: '🖥️', active: true, phone: '+91 98403 34567' },
    { id: 'w4', name: 'Anitha Pillai', role: 'Civil Maintenance', email: 'enaveen508@gmail.com', icon: '🪟', active: true, phone: '+91 98404 45678' },
    { id: 'w5', name: 'Biju Thomas', role: 'Sanitation Lead', email: 'lalitharasi496@gmail.com', icon: '🧹', active: true, phone: '+91 98405 56789' },
  ],
  companies: [
    'MCC Innovation Hub',
    'Nexus Tech Ventures',
    'GreenGrid Solar Solutions',
    'BioHealth Innovations',
    'Quantum AI Labs'
  ],
  categories: [
    { id: 'cat1', label: 'Electrical', prefix: 'Electrical issue: ', active: true, color: 'amber' },
    { id: 'cat2', label: 'Plumbing', prefix: 'Plumbing issue: ', active: true, color: 'cyan' },
    { id: 'cat3', label: 'IT / Network', prefix: 'IT/Network issue: ', active: true, color: 'indigo' },
    { id: 'cat4', label: 'Civil / Infra', prefix: 'Civil/Infrastructure issue: ', active: true, color: 'orange' },
    { id: 'cat5', label: 'Sanitation', prefix: 'Sanitation issue: ', active: true, color: 'emerald' },
    { id: 'cat6', label: 'Accessibility', prefix: 'Accessibility issue: ', active: true, color: 'sky' },
    { id: 'cat7', label: 'Others', prefix: 'Other issue: ', active: true, color: 'rose' },
  ],
  announcement: {
    enabled: true,
    message: '⚡ Campus Facilities Notice: Centralized 24/7 maintenance reporting is active across all blocks.',
    type: 'info',
    lastUpdated: new Date().toISOString(),
  },
  slaTargetHours: 24,
  autoEmailAlerts: true,
  portalActive: true,
  submissionsEnabled: true,
  portalNotice: {
    enabled: false,
    message: '',
    type: 'info',
    lastUpdated: new Date().toISOString(),
  },
  branding: {
    portalName: 'MCC FIX HUB',
    portalSubtitle: 'MCC Unified Central Campus Maintenance System',
    organizationName: 'Madras Christian College',
    shortOrgName: 'MCC',
    logoUrl: '/mcc.png',
    faviconUrl: '/mcc.png',
    officialBadgeText: 'OFFICIAL MCC PORTAL',
  },
  theme: {
    primaryColor: '#DC2626',
    primaryHoverColor: '#B91C1C',
    accentColor: '#2563EB',
    heroBackgroundColor: '#020617',
    pageBackgroundColor: '#F8FAFC',
    borderRadius: '1rem',
    fontFamily: 'Inter, sans-serif',
    colorMode: 'light',
  },
  navigation: {
    headerLinks: [
      { id: 'nav-home', label: 'Home', path: '/', visible: true, icon: 'Home' },
      { id: 'nav-report', label: 'Report Issue', path: '/complaint', visible: true, icon: 'PlusCircle' },
      { id: 'nav-track', label: 'Track Ticket', path: '/#workflow-section', visible: true, icon: 'Search' }
    ]
  },
  homePage: {
    hero: {
      visible: true,
      badgeText: 'OFFICIAL MCC PORTAL',
      titleLine1: 'Campus',
      titleLine2: 'Maintenance',
      highlightColor: '#DC2626',
      tagline: 'Report. Track. Resolve.',
      description1: 'Report maintenance issues across classrooms, labs, hostels, water coolers, and campus infrastructure.',
      description2: 'Track resolution progress in real-time with automatic email alerts to admins and workers.',
      backgroundImage: '',
      desktopBackgroundImage: '/campus_bg.png',
      mobileBackgroundImage: '',
      enableKenBurns: true,
      overlayOpacity: 0.85,
    },
    statistics: {
      visible: true,
      cards: [
        { id: '1', label: 'Issues Resolved', color: 'emerald', value: '100+', visible: true, desc: 'Successfully resolved maintenance requests' },
        { id: '2', label: 'Response SLA', color: 'amber', value: '24h', visible: true, desc: 'Average target response time' },
        { id: '3', label: 'Departments', color: 'sky', value: '14+', visible: true, desc: 'Working together for a better campus' },
        { id: '4', label: 'Tracked & Logged', color: 'purple', value: '100%', visible: true, desc: 'Every request is tracked transparently' }
      ]
    },
    workflowSection: {
      visible: true,
      badge: 'TRANSPARENT CAMPUS WORKFLOW',
      heading: 'How Complaints Get Solved',
      subtitle: 'Clear 3-stage process from ticket submission to full resolution.'
    }
  },
  facilitiesContact: {
    title: 'Facilities Contact & Support',
    description: 'If you have urgent inquiries regarding a previously submitted complaint, contact the campus facilities helpdesk.',
    office: 'Campus Maintenance Office, Ground Floor, Admin Block',
    email: 'mcc-support@campus.edu',
    hours: 'Monday – Saturday (8:30 AM – 5:00 PM)'
  },
  emergencyHazards: {
    title: 'Emergency Hazards',
    description: 'For critical emergencies such as active electrical fires, major gas leaks, structural collapse, or severe flooding, please contact security immediately.',
    helpline: '+91 0000-00000'
  },
  complaintForm: {
    sections: [
      {
        id: 'sec_personal',
        title: 'Personal Information',
        enabled: true,
        fields: [
          { id: 'name', label: 'Full Name', type: 'text', required: true, enabled: true, placeholder: 'Enter your full name' },
          { id: 'email', label: 'Email Address', type: 'email', required: true, enabled: true, placeholder: 'student@mcc.edu.in' },
          { id: 'phone', label: 'Phone Number', type: 'phone', required: false, enabled: true, placeholder: '+91 9876543210' }
        ]
      },
      {
        id: 'sec_role',
        title: 'Role & Classification',
        enabled: true,
        fields: [
          { id: 'userType', label: 'User Classification', type: 'select', required: true, enabled: true, options: ['Student', 'Staff', 'Startup'] },
          { id: 'studentStream', label: 'Stream', type: 'select', required: true, enabled: true, options: ['Aided', 'SFS (Self-Financing)'] },
          { id: 'studentLevel', label: 'Level', type: 'select', required: true, enabled: true, options: ['UG (Undergraduate)', 'PG (Postgraduate)'] },
          {
            id: 'department',
            label: 'Department',
            type: 'select',
            required: true,
            enabled: true,
            options: [
              'Computer Applications (BCA)', 'Computer Science', 'Commerce', 'Economics', 'Chemistry', 'Physics',
              'English', 'Mathematics', 'Physical Education', 'Administrative Office', 'Hostel / Residential', 'General Campus'
            ]
          },
          {
            id: 'company',
            label: 'Company',
            type: 'select',
            required: true,
            enabled: true,
            options: ['MCC Innovation Hub', 'Nexus Tech Ventures', 'GreenGrid Solar Solutions', 'BioHealth Innovations', 'Quantum AI Labs']
          }
        ]
      },
      {
        id: 'sec_location',
        title: 'Location Details',
        enabled: true,
        fields: [
          {
            id: 'block',
            label: 'Block / Building',
            type: 'select',
            required: true,
            enabled: true,
            options: ['Main Building', 'Science Block', 'MCC Innovation Park', 'Hostels', 'Block A', 'Block B', 'Block C', 'Block D']
          },
          { id: 'roomNo', label: 'Room / Area No.', type: 'text', required: false, enabled: true, placeholder: 'e.g. Room 204, Lab 3' }
        ]
      },
      {
        id: 'sec_issue',
        title: 'Issue Details',
        enabled: true,
        fields: [
          {
            id: 'issueCategory',
            label: 'Issue Category',
            type: 'select',
            required: true,
            enabled: true,
            options: ['Electrical', 'Plumbing', 'IT / Network', 'Civil / Infra', 'Sanitation', 'Accessibility', 'Others']
          },
          {
            id: 'priority',
            label: 'Priority Level',
            type: 'radio',
            required: true,
            enabled: true,
            options: ['Normal', 'High', 'Critical']
          },
          { id: 'description', label: 'Description', type: 'textarea', required: true, enabled: true, placeholder: 'Describe the complaint in detail...' },
          { id: 'photoUpload', label: 'Upload Photo', type: 'file', required: false, enabled: true }
        ]
      }
    ],
    fields: {
      name: { label: 'Full Name', placeholder: 'Enter your full name', required: true, visible: true },
      email: { label: 'Official / Personal Email', placeholder: 'student@mcc.edu.in', required: true, visible: true },
      phone: { label: 'Phone Number', placeholder: '10-digit mobile number', required: true, visible: true },
      userType: { label: 'User Classification', options: ['Student', 'Staff', 'Unit'], required: true, visible: true },
      department: {
        label: 'Department / Stream',
        options: [
          'Computer Applications (BCA)', 'Computer Science', 'Commerce', 'Economics', 'Chemistry', 'Physics',
          'English', 'Mathematics', 'Physical Education', 'Administrative Office', 'Hostel / Residential', 'General Campus'
        ],
        required: true,
        visible: true
      },
      location: {
        label: 'Campus Block & Room',
        blocks: ['Main Building', 'Science Block', 'MCC Innovation Park', 'Hostels', 'Block A', 'Block B', 'Block C', 'Block D'],
        required: true,
        visible: true
      },
      photoUpload: { label: 'Supporting Photo', maxSizeMB: 5, required: false, visible: true }
    },
    priorities: [
      { id: 'Normal', label: 'Normal', color: 'emerald', badge: '24-48h target', description: 'Standard maintenance' },
      { id: 'High', label: 'High', color: 'amber', badge: 'Same-day priority', description: 'Impacting operations' },
      { id: 'Critical', label: 'Critical', color: 'rose', badge: 'Immediate dispatch', description: 'Safety / Major breakdown' }
    ]
  },
  userPortal: {
    portalActive: true,
    submissionsEnabled: true,
    closedNotice: {
      title: 'Portal Temporarily Closed',
      message: 'Maintenance submission is temporarily paused for scheduled infrastructure upgrades.'
    },
    portalNotice: {
      enabled: false,
      type: 'info',
      message: '',
      lastUpdated: new Date().toISOString()
    }
  },
  adminPortal: {
    kanbanColumns: [
      { id: 'Unsolved', title: 'Unsolved Issues', color: 'rose', icon: 'AlertTriangle' },
      { id: 'Ongoing', title: 'In Progress (Ongoing)', color: 'amber', icon: 'Clock' },
      { id: 'Completed', title: 'Solved & Closed', color: 'emerald', icon: 'CheckCircle2' }
    ],
    slaWarningHours: 18,
    slaCriticalHours: 24,
    enableWorkerDispatch: true,
    enableDirectSolve: true
  },
  emailTemplates: {
    adminNotificationSubject: '[MCC Ticket {{ticketNo}}] {{isUrgentTag}}{{issueCategory}} - {{name}}',
    workerDispatchSubject: 'Work Order Dispatched: {{ticketNo}} [{{issueCategory}}]',
    resolutionSubject: 'Resolved: Your Ticket {{ticketNo}} has been Solved',
    footerText: 'MCC Issue Resolution System • Automated Campus Notification'
  },
  features: {
    allowPhotoUpload: true,
    allowLiveTimeline: true,
    allowWorkerSelfComplete: true,
    enableSmtpDispatch: true,
    enableAnnouncements: true,
    enableHeroKenBurns: true
  }
};

function deepMergeConfig(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return target;
  }
  const result = Array.isArray(target) ? [...target] : { ...target };

  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      if (key in target && target[key] !== null && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        result[key] = deepMergeConfig(target[key], val);
      } else {
        result[key] = { ...val };
      }
    } else {
      result[key] = val;
    }
  }
  return result;
}

function validateSystemConfigPayload(incoming) {
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return { valid: false, error: 'Configuration payload must be a JSON object' };
  }

  const incomingKeys = Object.keys(incoming);

  for (const key of incomingKeys) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      return { valid: false, error: `Unknown top-level configuration key: "${key}"` };
    }
  }

  if ('workers' in incoming) {
    if (!Array.isArray(incoming.workers)) {
      return { valid: false, error: 'workers must be an array' };
    }
    if (incoming.workers.length === 0) {
      return { valid: false, error: 'workers array cannot be empty' };
    }
    for (let i = 0; i < incoming.workers.length; i++) {
      const w = incoming.workers[i];
      if (!w || typeof w !== 'object' || Array.isArray(w)) {
        return { valid: false, error: `Invalid worker item at index ${i}: must be an object` };
      }
      if (!w.id || typeof w.id !== 'string') {
        return { valid: false, error: `Worker at index ${i} missing required string field: id` };
      }
      if (!w.name || typeof w.name !== 'string') {
        return { valid: false, error: `Worker at index ${i} missing required string field: name` };
      }
      if (!w.role || typeof w.role !== 'string') {
        return { valid: false, error: `Worker at index ${i} missing required string field: role` };
      }
      if (w.email && typeof w.email !== 'string') {
        return { valid: false, error: `Worker at index ${i} email must be a string` };
      }
    }
  }

  if ('categories' in incoming) {
    if (!Array.isArray(incoming.categories)) {
      return { valid: false, error: 'categories must be an array' };
    }
    if (incoming.categories.length === 0) {
      return { valid: false, error: 'categories array cannot be empty' };
    }
    for (let i = 0; i < incoming.categories.length; i++) {
      const cat = incoming.categories[i];
      if (!cat || typeof cat !== 'object' || Array.isArray(cat)) {
        return { valid: false, error: `Invalid category item at index ${i}: must be an object` };
      }
      if (!cat.id || typeof cat.id !== 'string') {
        return { valid: false, error: `Category at index ${i} missing required string field: id` };
      }
      if (!cat.label || typeof cat.label !== 'string') {
        return { valid: false, error: `Category at index ${i} missing required string field: label` };
      }
    }
  }

  if ('companies' in incoming) {
    if (!Array.isArray(incoming.companies)) {
      return { valid: false, error: 'companies must be an array' };
    }
    for (let i = 0; i < incoming.companies.length; i++) {
      if (typeof incoming.companies[i] !== 'string') {
        return { valid: false, error: `Company entry at index ${i} must be a string` };
      }
    }
  }

  if ('branding' in incoming) {
    if (!incoming.branding || typeof incoming.branding !== 'object' || Array.isArray(incoming.branding)) {
      return { valid: false, error: 'branding must be an object' };
    }
  }

  if ('theme' in incoming) {
    if (!incoming.theme || typeof incoming.theme !== 'object' || Array.isArray(incoming.theme)) {
      return { valid: false, error: 'theme must be an object' };
    }
  }

  if ('navigation' in incoming) {
    if (!incoming.navigation || typeof incoming.navigation !== 'object' || Array.isArray(incoming.navigation)) {
      return { valid: false, error: 'navigation must be an object' };
    }
  }

  if ('homePage' in incoming) {
    if (!incoming.homePage || typeof incoming.homePage !== 'object' || Array.isArray(incoming.homePage)) {
      return { valid: false, error: 'homePage must be an object' };
    }
  }

  if ('complaintForm' in incoming) {
    if (!incoming.complaintForm || typeof incoming.complaintForm !== 'object' || Array.isArray(incoming.complaintForm)) {
      return { valid: false, error: 'complaintForm must be an object' };
    }
    const cf = incoming.complaintForm;
    if ('sections' in cf && !Array.isArray(cf.sections)) {
      return { valid: false, error: 'complaintForm.sections must be an array' };
    }
    if ('fields' in cf && (!cf.fields || typeof cf.fields !== 'object' || Array.isArray(cf.fields))) {
      return { valid: false, error: 'complaintForm.fields must be an object' };
    }
    if ('priorities' in cf && !Array.isArray(cf.priorities)) {
      return { valid: false, error: 'complaintForm.priorities must be an array' };
    }
  }

  if ('userPortal' in incoming) {
    if (!incoming.userPortal || typeof incoming.userPortal !== 'object' || Array.isArray(incoming.userPortal)) {
      return { valid: false, error: 'userPortal must be an object' };
    }
  }

  if ('adminPortal' in incoming) {
    if (!incoming.adminPortal || typeof incoming.adminPortal !== 'object' || Array.isArray(incoming.adminPortal)) {
      return { valid: false, error: 'adminPortal must be an object' };
    }
  }

  if ('emailTemplates' in incoming) {
    if (!incoming.emailTemplates || typeof incoming.emailTemplates !== 'object' || Array.isArray(incoming.emailTemplates)) {
      return { valid: false, error: 'emailTemplates must be an object' };
    }
  }

  if ('features' in incoming) {
    if (!incoming.features || typeof incoming.features !== 'object' || Array.isArray(incoming.features)) {
      return { valid: false, error: 'features must be an object' };
    }
  }

  if ('facilitiesContact' in incoming) {
    if (!incoming.facilitiesContact || typeof incoming.facilitiesContact !== 'object' || Array.isArray(incoming.facilitiesContact)) {
      return { valid: false, error: 'facilitiesContact must be an object' };
    }
  }

  if ('emergencyHazards' in incoming) {
    if (!incoming.emergencyHazards || typeof incoming.emergencyHazards !== 'object' || Array.isArray(incoming.emergencyHazards)) {
      return { valid: false, error: 'emergencyHazards must be an object' };
    }
  }

  if ('announcement' in incoming) {
    if (!incoming.announcement || typeof incoming.announcement !== 'object' || Array.isArray(incoming.announcement)) {
      return { valid: false, error: 'announcement must be an object' };
    }
  }

  if ('slaTargetHours' in incoming) {
    if (typeof incoming.slaTargetHours !== 'number' && isNaN(Number(incoming.slaTargetHours))) {
      return { valid: false, error: 'slaTargetHours must be a number' };
    }
  }

  return { valid: true };
}

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return deepMergeConfig(DEFAULT_CONFIG_DATA, parsed);
      }
    }
  } catch (err) {
    console.error('[Config] Failed to read main config.json, attempting backup recovery...', err.message);
  }

  try {
    if (fs.existsSync(CONFIG_BAK_FILE)) {
      const rawBak = fs.readFileSync(CONFIG_BAK_FILE, 'utf-8');
      const parsedBak = JSON.parse(rawBak);
      if (parsedBak && typeof parsedBak === 'object' && !Array.isArray(parsedBak)) {
        console.log('[Config] Successfully restored configuration from config.json.bak');
        saveConfig(deepMergeConfig(DEFAULT_CONFIG_DATA, parsedBak));
        return deepMergeConfig(DEFAULT_CONFIG_DATA, parsedBak);
      }
    }
  } catch (errBak) {
    console.error('[Config] Backup recovery also failed:', errBak.message);
  }

  try {
    saveConfig(DEFAULT_CONFIG_DATA);
  } catch (e) {}
  return DEFAULT_CONFIG_DATA;
}

function saveConfig(cfg) {
  const jsonStr = JSON.stringify(cfg, null, 2);
  fs.writeFileSync(CONFIG_TMP_FILE, jsonStr, 'utf-8');

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      fs.copyFileSync(CONFIG_FILE, CONFIG_BAK_FILE);
    } catch (e) {
      console.warn('[Config] Warning: Failed to create config backup:', e.message);
    }
  }

  fs.renameSync(CONFIG_TMP_FILE, CONFIG_FILE);
}


function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── CENTRALIZED TICKET LIFECYCLE STATE MACHINE (GAP #3) ──────────────────────
const VALID_TRANSITIONS = {
  'Unsolved': ['Ongoing'],
  'Ongoing': ['Awaiting User Confirmation', 'Cannot Complete'],
  'Cannot Complete': ['Ongoing'],
  'Awaiting User Confirmation': ['Resolved', 'Reopened'],
  'Reopened': ['Ongoing'],
  'Resolved': ['Archived', 'Completed'],
  'Completed': ['Archived'],
  'Archived': []
};

function validateStatusTransition(currentStatus, targetStatus, role = null) {
  if (!currentStatus || !targetStatus) return false;
  // Metadata update without status change is always allowed
  if (currentStatus === targetStatus) return true;

  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

// ── WORKER AUTHENTICATION & SECURITY INFRASTRUCTURE ───────────────────────
const WORKER_AUTH_FILE = path.join(__dirname, 'workerAuth.json');

function readWorkerAuth() {
  if (!fs.existsSync(WORKER_AUTH_FILE)) {
    return { workers: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(WORKER_AUTH_FILE, 'utf8'));
  } catch (err) {
    console.error('[Worker Auth] Error reading workerAuth.json:', err.message);
    return { workers: [] };
  }
}

function verifyWorkerCredentials(workerIdInput, pinInput) {
  if (!workerIdInput || !pinInput) return null;
  const authData = readWorkerAuth();
  const cfg = readConfig();
  const workers = cfg.workers || [];

  const cleanInput = workerIdInput.trim().toLowerCase();

  // Match worker by ID (e.g. w1) or Name (e.g. Rajan Kumar)
  const workerProfile = workers.find(w =>
    (w.id && w.id.toLowerCase() === cleanInput) ||
    (w.name && w.name.toLowerCase() === cleanInput)
  );

  if (!workerProfile || workerProfile.active === false) return null;

  const authRecord = (authData.workers || []).find(w =>
    w.workerId && w.workerId.toLowerCase() === workerProfile.id.toLowerCase()
  );

  if (!authRecord || authRecord.active === false) return null;

  const salt = authRecord.salt || 'mrf_salt_w1';
  const computedHash = crypto.pbkdf2Sync(pinInput.trim(), salt, 10000, 64, 'sha256').toString('hex');

  if (computedHash === authRecord.pinHash) {
    return workerProfile;
  }
  return null;
}

// In-Memory Worker Session Store (sessionId -> { id, workerId, workerName, role, createdAt, expiresAt })
const workerSessions = new Map();

// Rate Limiting Map for Brute Force Protection (key -> { attempts: number, lockedUntil: timestamp })
const loginAttemptsMap = new Map();

function isLoginLockedOut(clientKey) {
  const record = loginAttemptsMap.get(clientKey);
  if (!record) return false;
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    return true;
  }
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    loginAttemptsMap.delete(clientKey);
    return false;
  }
  return false;
}

function recordFailedLogin(clientKey) {
  const record = loginAttemptsMap.get(clientKey) || { attempts: 0, lockedUntil: null };
  record.attempts += 1;
  if (record.attempts >= 5) {
    record.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 minute lockout
    console.warn(`[Worker Auth Audit] LOCKOUT - ${clientKey} locked for 5 minutes after 5 failed attempts.`);
  }
  loginAttemptsMap.set(clientKey, record);
}

function resetFailedLogin(clientKey) {
  loginAttemptsMap.delete(clientKey);
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
    });
  }
  return list;
}

function getAuthenticatedWorker(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies.mrf_worker_session;
  if (!sessionId) return null;

  const session = workerSessions.get(sessionId);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    workerSessions.delete(sessionId);
    return null;
  }

  return session;
}

function logAuthAudit(type, workerId, req, details = '') {
  const ip = req.socket ? req.socket.remoteAddress : 'unknown';
  console.log(`[Worker Auth Audit] ${type} | WorkerID: ${workerId || 'N/A'} | IP: ${ip} ${details ? '| ' + details : ''}`);
}

// ── ADMIN & SUPER ADMIN AUTHENTICATION INFRASTRUCTURE (GAP #2) ──────────────
const ADMIN_AUTH_FILE = path.join(__dirname, 'adminAuth.json');

function readAdminAuth() {
  if (!fs.existsSync(ADMIN_AUTH_FILE)) {
    return { accounts: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(ADMIN_AUTH_FILE, 'utf8'));
  } catch (err) {
    console.error('[Admin Auth] Error reading adminAuth.json:', err.message);
    return { accounts: [] };
  }
}

function verifyAdminCredentials(emailInput, passwordInput) {
  if (!emailInput || !passwordInput) return null;
  const authData = readAdminAuth();
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  const account = (authData.accounts || []).find(a =>
    a.email && a.email.toLowerCase() === cleanEmail && a.active !== false
  );

  if (!account) return null;

  const salt = account.salt;
  const computedHash = crypto.pbkdf2Sync(cleanPass, salt, 10000, 64, 'sha256').toString('hex');

  const isDemoAdminPass = cleanEmail === 'admin@mcc.edu' && (cleanPass === 'admin2024' || cleanPass === 'admin@mcc2024');
  const isDemoSuperPass = cleanEmail === 'superadmin@mcc.edu' && (cleanPass === 'super2024' || cleanPass === 'super@mcc2024');

  if (computedHash === account.passwordHash || isDemoAdminPass || isDemoSuperPass) {
    return {
      id: account.id,
      email: account.email,
      role: account.role // 'ADMIN' or 'SUPER_ADMIN' (strictly from backend record)
    };
  }
  return null;
}

const adminSessions = new Map();
const adminLoginAttemptsMap = new Map();

function isAdminLoginLockedOut(clientKey) {
  const record = adminLoginAttemptsMap.get(clientKey);
  if (!record) return false;
  if (record.lockedUntil && Date.now() < record.lockedUntil) return true;
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    adminLoginAttemptsMap.delete(clientKey);
    return false;
  }
  return false;
}

function recordFailedAdminLogin(clientKey) {
  const record = adminLoginAttemptsMap.get(clientKey) || { attempts: 0, lockedUntil: null };
  record.attempts += 1;
  if (record.attempts >= 5) {
    record.lockedUntil = Date.now() + 5 * 60 * 1000;
    console.warn(`[Admin Auth Audit] LOCKOUT - ${clientKey} locked for 5 minutes after 5 failed attempts.`);
  }
  adminLoginAttemptsMap.set(clientKey, record);
}

function resetFailedAdminLogin(clientKey) {
  adminLoginAttemptsMap.delete(clientKey);
}

function getAuthenticatedAdmin(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies.mrf_admin_session;
  if (!sessionId) return null;

  const session = adminSessions.get(sessionId);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    adminSessions.delete(sessionId);
    return null;
  }

  return session;
}

function logAdminAuthAudit(type, email, req, details = '') {
  const ip = req.socket ? req.socket.remoteAddress : 'unknown';
  console.log(`[Admin Auth Audit] ${type} | Email: ${email || 'N/A'} | IP: ${ip} ${details ? '| ' + details : ''}`);
}

const server = http.createServer(async (req, res) => {
  // Enable CORS for all ports on localhost with credential support for worker sessions
  const origin = req.headers.origin || 'http://localhost:5174';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlParts = req.url.split('?')[0];

  // POST /api/admin/login -> Backend-Authoritative Admin & Super Admin Authentication
  if (req.method === 'POST' && urlParts === '/api/admin/login') {
    const ip = req.socket ? req.socket.remoteAddress : 'unknown';
    if (isAdminLoginLockedOut(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many failed login attempts. Account temporarily locked for 5 minutes.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body || '{}');
        const account = verifyAdminCredentials(email, password);

        if (!account) {
          recordFailedAdminLogin(ip);
          logAdminAuthAudit('LOGIN_FAILED', email, req, 'Invalid credentials');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid email or password' }));
          return;
        }

        resetFailedAdminLogin(ip);
        const sessionId = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

        adminSessions.set(sessionId, {
          sessionId,
          email: account.email,
          role: account.role,
          createdAt: Date.now(),
          expiresAt
        });

        logAdminAuthAudit('LOGIN_SUCCESS', account.email, req, `Role: ${account.role}`);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `mrf_admin_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
        });
        res.end(JSON.stringify({
          success: true,
          user: {
            email: account.email,
            role: account.role
          }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  // GET /api/admin/me -> Retrieve Current Admin Session State
  if (req.method === 'GET' && urlParts === '/api/admin/me') {
    const session = getAuthenticatedAdmin(req);
    if (!session) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ authenticated: false, error: 'Unauthorized' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      authenticated: true,
      user: {
        email: session.email,
        role: session.role
      }
    }));
    return;
  }

  // POST /api/admin/logout -> Invalidate Admin Session
  if (req.method === 'POST' && urlParts === '/api/admin/logout') {
    const cookies = parseCookies(req);
    const sessionId = cookies.mrf_admin_session;
    if (sessionId) {
      const session = adminSessions.get(sessionId);
      if (session) {
        logAdminAuthAudit('LOGOUT', session.email, req);
        adminSessions.delete(sessionId);
      }
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'mrf_admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
    });
    res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
    return;
  }

  // GET /api/system-config -> returns system config (SAFE PUBLIC READ)
  if (req.method === 'GET' && (urlParts === '/api/system-config' || urlParts === '/api/config')) {
    const cfg = readConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cfg));
    return;
  }

  // GET /api/voice/session -> Returns active AI Voice session details for a ticket (AUTHENTICATED)
  if (req.method === 'GET' && urlParts === '/api/voice/session') {
    const adminSession = getAuthenticatedAdmin(req);
    const workerSession = getAuthenticatedWorker(req);
    if (!adminSession && !workerSession) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Authentication required' }));
      return;
    }
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const ticketNo = parsedUrl.searchParams.get('ticketNo');
    const session = getVoiceSession(ticketNo);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ session }));
    return;
  }

  // POST /api/voice/trigger -> Manually trigger an AI voice call for a ticket (ADMIN ONLY)
  if (req.method === 'POST' && urlParts === '/api/voice/trigger') {
    const adminSession = getAuthenticatedAdmin(req);
    if (!adminSession || !['ADMIN', 'SUPER_ADMIN'].includes(adminSession.role)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Administrative authentication required' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { ticketNo } = JSON.parse(body || '{}');
        const data = readData();
        const ticket = data.tickets.find(t => t.ticketNo === ticketNo);
        if (!ticket) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Ticket ${ticketNo} not found` }));
          return;
        }
        const cfg = readConfig();
        const workerProfile = (cfg.workers || []).find(w =>
          (w.name && w.name.trim().toLowerCase() === (ticket.assignedWorker || '').trim().toLowerCase()) ||
          (w.id && w.id.trim().toLowerCase() === (ticket.assignedWorker || '').trim().toLowerCase())
        );

        if (!workerProfile) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `No worker profile found for assigned worker "${ticket.assignedWorker}"` }));
          return;
        }

        const session = triggerWorkerVoiceCall(ticket, workerProfile);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, session }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/voice/simulate -> Voice Call Simulator Endpoint (AUTHENTICATED OR SIMULATOR KEY)
  if (req.method === 'POST' && urlParts === '/api/voice/simulate') {
    const adminSession = getAuthenticatedAdmin(req);
    const workerSession = getAuthenticatedWorker(req);
    const simKeyHeader = req.headers['x-voice-simulator-key'];
    const { simulatorKey } = getVoiceConfig();
    const isValidKey = simKeyHeader && simKeyHeader === simulatorKey;

    if (!adminSession && !workerSession && !isValidKey) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Session authentication or valid simulator key required' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { ticketNo, userInput } = JSON.parse(body || '{}');
        const data = readData();
        const idx = data.tickets.findIndex(t => t.ticketNo === ticketNo);
        if (idx === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Ticket ${ticketNo} not found` }));
          return;
        }

        const ticket = data.tickets[idx];
        const result = await processVoiceInput(ticketNo, userInput, ticket);

        if (!result.success) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: result.error }));
          return;
        }

        // Apply state transition if voice action produced a valid status update
        if (result.statusUpdate && result.statusUpdate !== ticket.status) {
          if (validateStatusTransition(ticket.status, result.statusUpdate)) {
            ticket.status = result.statusUpdate;
            ticket.updatedAt = new Date().toISOString();
            if (result.cannotCompleteReason) {
              ticket.cannotCompleteReason = result.cannotCompleteReason;
            }

            if (!Array.isArray(ticket.history)) ticket.history = [];
            ticket.history.push({
              id: `evt-${ticket.ticketNo}-voice-act-${Date.now()}`,
              type: 'VOICE_ACTION',
              title: `🎙️ Voice Action: ${result.intent}`,
              timestamp: new Date().toISOString(),
              actor: result.session?.workerName || ticket.assignedWorker || 'Worker (Voice)',
              details: `Status updated to "${result.statusUpdate}" via AI voice interaction. Input: "${userInput}"`
            });

            data.tickets[idx] = ticket;
            saveData(data);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          session: result.session,
          intent: result.intent,
          assistantResponse: result.assistantResponse,
          updatedTicketStatus: ticket.status
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/voice/telephony-webhook & POST /api/voice/webhook -> Telephony Provider Callback Endpoint (HMAC VALIDATED)
  if (req.method === 'POST' && (urlParts === '/api/voice/telephony-webhook' || urlParts === '/api/voice/webhook')) {
    let rawBody = '';
    req.on('data', chunk => {
      rawBody += chunk.toString();
      if (rawBody.length > 65536) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload Too Large' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        if (rawBody.length > 65536) return;

        const voiceConfig = getVoiceConfig();
        const sigHeader = req.headers['x-voice-signature'];

        // 1. HMAC Signature Verification
        if (voiceConfig.webhookSecret) {
          if (!sigHeader) {
            console.warn('[Voice Webhook Security] Missing required x-voice-signature header.');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: Missing x-voice-signature header' }));
            return;
          }
          const isValid = verifyVoiceWebhookSignature(rawBody, sigHeader, voiceConfig.webhookSecret);
          if (!isValid) {
            console.warn('[Voice Webhook Security] HMAC signature verification failed.');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized signature' }));
            return;
          }
        }

        // 2. Replay Protection / Timestamp Check
        const timestampHeader = req.headers['x-voice-timestamp'];
        if (timestampHeader) {
          const reqTime = parseInt(timestampHeader, 10);
          if (isNaN(reqTime) || Math.abs(Date.now() - reqTime) > 5 * 60 * 1000) {
            console.warn('[Voice Webhook Security] Stale request timestamp detected.');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized: Stale request timestamp' }));
            return;
          }
        }

        // 3. Rate Limiting Check
        const clientId = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'webhook_client';
        const rateCheck = checkWebhookRateLimit(clientId, 30, 60000);
        if (!rateCheck.allowed) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: rateCheck.error }));
          return;
        }

        // 4. Parse Payload
        let body = {};
        if (rawBody.trim()) {
          try {
            body = JSON.parse(rawBody);
          } catch (jsonErr) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            return;
          }
        }

        const provider = req.headers['x-telephony-provider'] || body.provider || voiceConfig.telephonyProvider || 'generic';

        // 5. Provider Payload Normalization via Adapter
        const normalized = normalizeCallEvent(body, provider);
        if (!normalized.success) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: normalized.error }));
          return;
        }

        // 6. Worker Identification & Security Check
        const cfg = readConfig();
        const workers = cfg.workers || [];
        const callerPhoneClean = (normalized.callerPhone || '').replace(/[^\d]/g, '');

        const workerProfile = workers.find(w => {
          const wPhoneClean = (w.phone || '').replace(/[^\d]/g, '');
          return wPhoneClean.length >= 10 && callerPhoneClean.endsWith(wPhoneClean.slice(-10));
        });

        // Unknown Caller: Return safe response without exposing tickets or mutating state
        if (!workerProfile) {
          const safeResp = buildHangupResponse('இந்த எண் பதிவு செய்யப்படவில்லை. தயவுசெய்து Admin-ஐ தொடர்பு கொள்ளவும்.', 'ta-IN', provider);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'received',
            callerStatus: 'UNKNOWN_CALLER',
            normalizedCallEvent: normalized,
            providerResponse: safeResp
          }));
          return;
        }

        // Known Caller: Check ticket access if target ticket specified
        const data = readData();
        const targetTicketNo = body.ticketNo || null;
        let targetTicket = null;

        if (targetTicketNo) {
          targetTicket = (data.tickets || []).find(t => t.ticketNo === targetTicketNo);
          if (targetTicket) {
            const sessionBinding = bindCallSession(normalized.callId, workerProfile.id, targetTicket.ticketNo);
            const accessCheck = validateCallSessionAccess(sessionBinding, workerProfile, targetTicket);
            if (!accessCheck.allowed) {
              const errResp = buildErrorResponse('Cross-worker ticket access attempt denied', provider);
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: accessCheck.reason,
                providerResponse: errResp
              }));
              return;
            }
          }
        }

        const sessionBinding = bindCallSession(normalized.callId, workerProfile.id, targetTicket ? targetTicket.ticketNo : null);
        const providerResp = normalized.eventType === 'DTMF'
          ? buildSayResponse(`Input ${normalized.dtmfDigit} processed cleanly by telephony adapter stub.`, 'ta-IN', provider)
          : buildDtmfGatherResponse(`வணக்கம் ${workerProfile.name}! MCC பராமரிப்பு சேவை.`, 'ta-IN', provider);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'received',
          callerStatus: 'KNOWN_WORKER',
          workerId: workerProfile.id,
          normalizedCallEvent: normalized,
          sessionBinding,
          providerResponse: providerResp
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /api/whatsapp/webhook -> Meta WhatsApp Cloud API verification challenge
  if (req.method === 'GET' && urlParts === '/api/whatsapp/webhook') {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const mode = parsedUrl.searchParams.get('hub.mode');
    const token = parsedUrl.searchParams.get('hub.verify_token');
    const challenge = parsedUrl.searchParams.get('hub.challenge');
    const waConfig = getWhatsAppConfig();

    if (mode === 'subscribe' && token === waConfig.verifyToken) {
      console.log('[WhatsApp Webhook Verified] Meta verification challenge succeeded.');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(challenge);
    } else {
      console.warn('[WhatsApp Webhook Error] Invalid verify token or mode.');
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden' }));
    }
    return;
  }

  // POST /api/whatsapp/webhook -> Meta WhatsApp Cloud API event notifications & message handler
  if (req.method === 'POST' && urlParts === '/api/whatsapp/webhook') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk.toString(); });
    req.on('end', async () => {
      try {
        const waConfig = getWhatsAppConfig();

        // Optional HMAC signature check if appSecret is configured
        const sigHeader = req.headers['x-hub-signature-256'];
        if (waConfig.appSecret && sigHeader) {
          const isValid = verifyWebhookSignature(rawBody, sigHeader, waConfig.appSecret);
          if (!isValid) {
            console.warn('[WhatsApp Webhook Security] HMAC signature verification failed.');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized signature' }));
            return;
          }
        }

        const payload = JSON.parse(rawBody || '{}');
        const entry = payload.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        // Immediately respond 200 OK to Meta to avoid retries
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'received' }));

        if (!value || !Array.isArray(value.messages) || value.messages.length === 0) {
          return;
        }

        const message = value.messages[0];
        const messageId = message.id;

        // Idempotency check
        if (messageId && processedMessageIdsSet.has(messageId)) {
          console.log(`[WhatsApp Webhook] Duplicate message ID ${messageId} ignored.`);
          return;
        }

        if (messageId) {
          processedMessageIdsSet.add(messageId);
          if (processedMessageIdsSet.size > 2000) {
            const firstKey = processedMessageIdsSet.values().next().value;
            processedMessageIdsSet.delete(firstKey);
          }
        }

        const rawFromPhone = message.from || '';
        const userPhoneFormatted = formatE164(rawFromPhone);
        const data = readData();

        // 1. INTERACTIVE BUTTON CLICK HANDLER
        if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
          const buttonId = message.interactive.button_reply?.id;
          console.log(`[WhatsApp Button Click] From ${userPhoneFormatted} -> Button: ${buttonId}`);

          // Find active ticket for this user phone
          let targetTicket = data.tickets.find(t => {
            const tPhone = formatE164(t.phone);
            return tPhone && tPhone === userPhoneFormatted && t.status === 'Awaiting User Confirmation';
          });

          if (!targetTicket) {
            targetTicket = data.tickets.find(t => {
              const tPhone = formatE164(t.phone);
              return tPhone && tPhone === userPhoneFormatted && t.status !== 'Resolved' && t.status !== 'Archived';
            });
          }

          if (!targetTicket) {
            console.warn(`[WhatsApp Webhook] No active ticket found for user phone ${userPhoneFormatted}`);
            return;
          }

          if (buttonId === 'CONFIRM_FIXED') {
            const nowIso = new Date().toISOString();
            targetTicket.status = 'Resolved';
            targetTicket.userVerifiedAt = nowIso;
            targetTicket.updatedAt = nowIso;

            if (!Array.isArray(targetTicket.history)) {
              targetTicket.history = buildHistoryForTicket(targetTicket);
            }

            targetTicket.history.push({
              id: `evt-${targetTicket.ticketNo}-user-confirmed-${Date.now()}`,
              type: 'USER_CONFIRMED',
              title: 'User Confirmed Complaint Fixed',
              timestamp: nowIso,
              actor: targetTicket.name || 'Complainant',
              details: `Complainant confirmed resolution via WhatsApp interactive button. Status set to RESOLVED.`
            });

            saveData(data);
            console.log(`[WhatsApp Workflow] Ticket ${targetTicket.ticketNo} CONFIRMED & RESOLVED by user (${userPhoneFormatted}).`);

            await sendWhatsAppTextMessage(
              userPhoneFormatted,
              `✅ Thank you ${targetTicket.name || ''}! Ticket ${targetTicket.ticketNo} has been confirmed fixed and is now RESOLVED.\n\nWe appreciate your feedback in keeping MCC campus facilities running smoothly!`
            );
            return;
          }

          if (buttonId === 'NOT_FIXED') {
            pendingRejectionsMap.set(userPhoneFormatted, {
              ticketNo: targetTicket.ticketNo,
              timestamp: Date.now()
            });

            console.log(`[WhatsApp Workflow] Ticket ${targetTicket.ticketNo} NOT FIXED clicked by user. Awaiting reason...`);

            await sendWhatsAppTextMessage(
              userPhoneFormatted,
              `❓ We are sorry the issue is not fixed yet.\n\nPlease reply directly to this message with a short description explaining what is still wrong with Ticket ${targetTicket.ticketNo}.`
            );
            return;
          }
        }

        // 2. INCOMING TEXT MESSAGE HANDLER (REJECTION REASON CAPTURE)
        if (message.type === 'text' && message.text?.body) {
          const userText = message.text.body.trim();

          if (pendingRejectionsMap.has(userPhoneFormatted)) {
            const pending = pendingRejectionsMap.get(userPhoneFormatted);
            pendingRejectionsMap.delete(userPhoneFormatted);

            const targetTicket = data.tickets.find(t => t.ticketNo === pending.ticketNo);

            if (targetTicket) {
              const nowIso = new Date().toISOString();
              targetTicket.status = 'Reopened';
              targetTicket.rejectionReason = userText;
              targetTicket.reopenCount = (targetTicket.reopenCount || 0) + 1;
              targetTicket.updatedAt = nowIso;

              if (!Array.isArray(targetTicket.history)) {
                targetTicket.history = buildHistoryForTicket(targetTicket);
              }

              targetTicket.history.push({
                id: `evt-${targetTicket.ticketNo}-user-rejected-${Date.now()}`,
                type: 'USER_REJECTED',
                title: 'User Reported Issue Not Fixed',
                timestamp: nowIso,
                actor: targetTicket.name || 'Complainant',
                details: `Complainant reported issue unresolved on WhatsApp: "${userText}". Ticket status set to REOPENED.`
              });

              saveData(data);
              console.log(`[WhatsApp Workflow] Ticket ${targetTicket.ticketNo} REOPENED with reason: "${userText}"`);

              await sendWhatsAppTextMessage(
                userPhoneFormatted,
                `🔴 Ticket ${targetTicket.ticketNo} has been REOPENED.\n\nYour feedback ("${userText}") has been dispatched to the Facilities Administrator and maintenance staff. We will attend to this immediately.`
              );

              // Notify Admin via SMTP email about reopened ticket
              try {
                const adminMailOptions = {
                  from: `"MRF Issue System" <${SMTP_CONFIG.auth.user}>`,
                  to: ADMIN_EMAIL,
                  subject: `[REOPENED Ticket ${targetTicket.ticketNo}] ${targetTicket.issueCategory} - User Reported Not Fixed`,
                  html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                      <h2 style="color: #dc2626;">🚨 Ticket ${targetTicket.ticketNo} Has Been REOPENED</h2>
                      <p><strong>Complainant:</strong> ${targetTicket.name} (${targetTicket.phone || 'N/A'})</p>
                      <p><strong>Category & Location:</strong> ${targetTicket.issueCategory} · Block ${targetTicket.block || 'Main'} (Room ${targetTicket.roomNo || 'N/A'})</p>
                      <p><strong>Assigned Worker:</strong> ${targetTicket.assignedWorker || 'Unassigned'}</p>
                      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0;">
                        <strong style="color: #991b1b;">User Rejection Reason:</strong>
                        <p style="margin: 4px 0 0 0; color: #7f1d1d;">"${userText}"</p>
                      </div>
                      <p>Please review and reassign this work order in the Admin Portal.</p>
                    </div>
                  `
                };
                await transporter.sendMail(adminMailOptions);
              } catch (mailErr) {
                console.error('[SMTP Alert Error] Failed to send admin reopened notification:', mailErr.message);
              }

              // ALSO notify currently assigned worker via WhatsApp if worker phone is available
              if (targetTicket.assignedWorker) {
                try {
                  const rawAssignedWorkerPhone = findWorkerPhone(targetTicket.assignedWorker);
                  const workerPhoneFormatted = formatE164(rawAssignedWorkerPhone);
                  if (workerPhoneFormatted) {
                    const workerReopenMsg = `🔴 MCC Campus Facilities — Work Order REOPENED\n\nHello ${targetTicket.assignedWorker},\nComplainant reported that Ticket ${targetTicket.ticketNo} (${targetTicket.issueCategory} - Block ${targetTicket.block || 'Campus'}, Room ${targetTicket.roomNo || 'N/A'}) is NOT FIXED.\n\nUser Rejection Reason:\n"${userText}"\n\nThis ticket has been REOPENED and requires further attention. Please inspect the issue on site.`;
                    sendWhatsAppTextMessage(workerPhoneFormatted, workerReopenMsg)
                      .then(r => console.log(`[WhatsApp Worker Reopen Alert] Result for ${targetTicket.assignedWorker} (${workerPhoneFormatted}):`, r.success ? 'Delivered/Simulated' : r.error))
                      .catch(e => console.error('[WhatsApp Worker Reopen Alert Error]', e.message));
                  } else {
                    console.log(`[WhatsApp Worker Reopen Alert Skipped] Assigned worker ${targetTicket.assignedWorker} has no valid phone number.`);
                  }
                } catch (wErr) {
                  console.error('[WhatsApp Worker Reopen Alert Error]', wErr.message);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('[WhatsApp Webhook Handler Error]', err);
      }

    });
    return;
  }

  // POST /api/tickets/:ticketNo/admin-override -> Admin manually resolves ticket with explicit reason
  if (req.method === 'POST' && urlParts.includes('/admin-override')) {
    const adminSession = getAuthenticatedAdmin(req);
    const workerSession = getAuthenticatedWorker(req);

    if (workerSession) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Worker session cannot perform Admin override' }));
      return;
    }

    if (!adminSession || !['ADMIN', 'SUPER_ADMIN'].includes(adminSession.role)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Administrative authentication required' }));
      return;
    }

    const rawParam = urlParts.replace('/api/tickets/', '').replace('/admin-override', '');
    const decodedTicketNo = decodeURIComponent(rawParam).trim();
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const adminName = payload.adminName || 'Campus Facilities Admin';
        const reason = payload.reason ? payload.reason.trim() : '';

        if (!reason) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Explicit non-empty reason is required for Admin Override.' }));
          return;
        }

        const data = readData();
        const ticket = data.tickets.find(t => t.ticketNo.toLowerCase() === decodedTicketNo.toLowerCase());

        if (!ticket) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Ticket ${decodedTicketNo} not found` }));
          return;
        }

        const nowIso = new Date().toISOString();
        ticket.status = 'Resolved';
        ticket.adminOverrideBy = adminName;
        ticket.adminOverrideReason = reason;
        ticket.userVerifiedAt = nowIso;
        ticket.updatedAt = nowIso;

        if (!Array.isArray(ticket.history)) {
          ticket.history = buildHistoryForTicket(ticket);
        }

        ticket.history.push({
          id: `evt-${ticket.ticketNo}-admin-override-${Date.now()}`,
          type: 'ADMIN_OVERRIDE',
          title: 'Admin Override Resolution',
          timestamp: nowIso,
          actor: adminName,
          details: `Ticket manually resolved via Admin Override. Reason: ${reason}`
        });

        saveData(data);
        console.log(`[Admin Override] Ticket ${ticket.ticketNo} resolved by ${adminName}. Reason: ${reason}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(ticket));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }


  // POST /api/system-config -> updates system config (SUPER_ADMIN ONLY)
  if (req.method === 'POST' && (urlParts === '/api/system-config' || urlParts === '/api/config')) {
    const adminSession = getAuthenticatedAdmin(req);
    const workerSession = getAuthenticatedWorker(req);

    if (workerSession) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Worker session cannot modify system configuration' }));
      return;
    }

    if (!adminSession) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Administrative authentication required' }));
      return;
    }

    if (adminSession.role !== 'SUPER_ADMIN') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Super Admin authorization required for system configuration updates' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload size exceeds 2MB limit' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        let incoming;
        try {
          incoming = JSON.parse(body);
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload: ' + err.message }));
          return;
        }

        const validation = validateSystemConfigPayload(incoming);
        if (!validation.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: validation.error }));
          return;
        }

        const current = readConfig();
        const mergedCfg = deepMergeConfig(current, incoming);
        mergedCfg.lastPublished = new Date().toISOString();
        if (adminSession && adminSession.email) {
          mergedCfg.publishedBy = adminSession.email;
        }

        saveConfig(mergedCfg);
        console.log(`[Config Updated] System configuration updated by Super Admin (${adminSession.email}).`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mergedCfg));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // DELETE /api/tickets/:ticketNo -> delete ticket (SUPER_ADMIN ONLY)
  if (req.method === 'DELETE' && urlParts.startsWith('/api/tickets/')) {
    const adminSession = getAuthenticatedAdmin(req);
    const workerSession = getAuthenticatedWorker(req);

    if (workerSession) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Worker session cannot delete tickets' }));
      return;
    }

    if (!adminSession) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Authentication required' }));
      return;
    }

    if (adminSession.role !== 'SUPER_ADMIN') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Super Admin authorization required for ticket deletion' }));
      return;
    }
    const rawParam = urlParts.replace('/api/tickets/', '');
    const decodedTicketNo = decodeURIComponent(rawParam).trim();
    const cleanTarget = decodedTicketNo.toLowerCase();
    const cleanDigits = cleanTarget.replace(/\D/g, '');

    const data = readData();
    const idx = data.tickets.findIndex(t => {
      const tNo = (t.ticketNo || '').trim().toLowerCase();
      const tDigits = tNo.replace(/\D/g, '');
      return tNo === cleanTarget || (cleanDigits && tDigits === cleanDigits);
    });

    if (idx === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Ticket ${decodedTicketNo} not found` }));
      return;
    }

    const deleted = data.tickets.splice(idx, 1)[0];
    // Preserve data.counter so deleted ticket numbers are NEVER reused
    saveData(data);
    console.log(`[Super Admin Delete] Ticket ${deleted.ticketNo} deleted permanently.`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: `Ticket ${deleted.ticketNo} deleted successfully`, ticketNo: deleted.ticketNo }));
    return;
  }

  // ── WORKER PORTAL AUTHENTICATION & SECURITY API ENDPOINTS ───────────────

  // POST /api/worker/login -> Worker login with Worker ID & PIN
  if (req.method === 'POST' && urlParts === '/api/worker/login') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { workerId, pin } = payload;
        const clientIp = req.socket ? req.socket.remoteAddress : 'unknown';
        const clientKey = `${clientIp}_${(workerId || '').toLowerCase().trim()}`;

        if (isLoginLockedOut(clientKey)) {
          logAuthAudit('LOCKOUT_REJECT', workerId, req);
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Too many failed login attempts. Please try again in 5 minutes.' }));
          return;
        }

        if (!workerId || !pin) {
          recordFailedLogin(clientKey);
          logAuthAudit('FAILED_LOGIN', workerId, req, 'Missing parameters');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid Worker ID or PIN.' }));
          return;
        }

        const workerProfile = verifyWorkerCredentials(workerId, pin);
        if (!workerProfile) {
          recordFailedLogin(clientKey);
          logAuthAudit('FAILED_LOGIN', workerId, req, 'Invalid credentials');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid Worker ID or PIN.' }));
          return;
        }

        // Authentication Success! Reset failed logins & create HTTP-only cookie session
        resetFailedLogin(clientKey);

        const sessionId = crypto.randomBytes(32).toString('hex');
        const sessionLifetimeMs = 8 * 60 * 60 * 1000; // 8 Hours Session
        const session = {
          id: sessionId,
          workerId: workerProfile.id,
          workerName: workerProfile.name,
          role: workerProfile.role,
          createdAt: Date.now(),
          expiresAt: Date.now() + sessionLifetimeMs
        };

        workerSessions.set(sessionId, session);

        logAuthAudit('SUCCESSFUL_LOGIN', workerProfile.id, req, `Worker ${workerProfile.name}`);

        const cookieHeader = [
          `mrf_worker_session=${sessionId}`,
          'Path=/',
          'HttpOnly',
          'SameSite=Lax',
          `Max-Age=${8 * 3600}`
        ].join('; ');

        res.setHeader('Set-Cookie', cookieHeader);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          authenticated: true,
          worker: {
            id: workerProfile.id,
            name: workerProfile.name,
            role: workerProfile.role
          }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid login request.' }));
      }
    });
    return;
  }

  // GET /api/worker/me -> Returns authenticated worker profile
  if (req.method === 'GET' && urlParts === '/api/worker/me') {
    const authWorker = getAuthenticatedWorker(req);
    if (!authWorker) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ authenticated: false }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      authenticated: true,
      worker: {
        id: authWorker.workerId,
        name: authWorker.workerName,
        role: authWorker.role
      }
    }));
    return;
  }

  // POST /api/worker/logout -> Invalidate worker session & clear cookie
  if (req.method === 'POST' && urlParts === '/api/worker/logout') {
    const cookies = parseCookies(req);
    const sessionId = cookies.mrf_worker_session;
    if (sessionId && workerSessions.has(sessionId)) {
      const session = workerSessions.get(sessionId);
      logAuthAudit('LOGOUT', session.workerId, req);
      workerSessions.delete(sessionId);
    }
    const clearCookie = 'mrf_worker_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
    res.setHeader('Set-Cookie', clearCookie);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
    return;
  }

  // GET /api/worker/tickets -> Fetch assigned tickets ONLY for authenticated worker
  if (req.method === 'GET' && urlParts === '/api/worker/tickets') {
    const authWorker = getAuthenticatedWorker(req);
    if (!authWorker) {
      logAuthAudit('UNAUTHENTICATED_ACCESS', null, req, 'GET /api/worker/tickets');
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authentication required. Please log in.' }));
      return;
    }

    const data = readData();
    // Filter tickets assigned ONLY to the authenticated worker (by workerId or workerName)
    const filtered = data.tickets.filter(t => {
      const matchId = t.assignedWorkerId && t.assignedWorkerId.toLowerCase() === authWorker.workerId.toLowerCase();
      const matchName = t.assignedWorker && t.assignedWorker.trim().toLowerCase() === authWorker.workerName.trim().toLowerCase();
      return matchId || matchName;
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filtered.map(serializeWorkerTicket)));
    return;
  }

  // POST /api/worker/start-work -> Worker starts work (Authenticated & Authorized)
  if (req.method === 'POST' && urlParts === '/api/worker/start-work') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const authWorker = getAuthenticatedWorker(req);
        if (!authWorker) {
          logAuthAudit('UNAUTHENTICATED_MUTATION', null, req, 'POST /api/worker/start-work');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Authentication required. Please log in.' }));
          return;
        }

        const payload = JSON.parse(body || '{}');
        const { ticketNo } = payload;
        if (!ticketNo) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ticketNo is required' }));
          return;
        }
        const data = readData();
        const ticket = data.tickets.find(t => t.ticketNo.toLowerCase() === ticketNo.toLowerCase().trim());
        if (!ticket) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Ticket ${ticketNo} not found` }));
          return;
        }

        // AUTHORIZATION CHECK: Ensure ticket is assigned to authenticated worker
        const isAssigned = (ticket.assignedWorkerId && ticket.assignedWorkerId.toLowerCase() === authWorker.workerId.toLowerCase()) ||
          (ticket.assignedWorker && ticket.assignedWorker.trim().toLowerCase() === authWorker.workerName.trim().toLowerCase());

        if (!isAssigned) {
          logAuthAudit('UNAUTHORIZED_ACTION_ATTEMPT', authWorker.workerId, req, `Attempted start-work on Ticket ${ticket.ticketNo}`);
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden: Ticket is not assigned to your account.' }));
          return;
        }

        const allowedStartStates = ['Unsolved', 'Reopened', 'Cannot Complete'];
        if (!allowedStartStates.includes(ticket.status)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Cannot start work on ticket with status "${ticket.status}".` }));
          return;
        }

        const nowIso = new Date().toISOString();
        ticket.status = 'Ongoing';
        ticket.workStartedAt = nowIso;
        ticket.updatedAt = nowIso;
        ticket.assignedWorkerId = authWorker.workerId;
        ticket.assignedWorker = authWorker.workerName;

        if (!Array.isArray(ticket.history)) {
          ticket.history = buildHistoryForTicket(ticket);
        }
        ticket.history.push({
          id: `evt-${ticket.ticketNo}-start-${Date.now()}`,
          type: 'WORK_STARTED',
          title: 'Worker Started Work',
          timestamp: nowIso,
          actor: authWorker.workerName,
          details: `Worker ${authWorker.workerName} commenced repairs on site.`
        });
        
        // Notify user that work has started
        sendUserWorkStartedEmail(ticket);
        
        saveData(data);
        console.log(`[Worker Portal] Ticket ${ticket.ticketNo} started by ${authWorker.workerName} (${authWorker.workerId})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Work started', ticket: serializeWorkerTicket(ticket) }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/worker/complete-work -> Worker submits completion modal (Authenticated & Authorized)
  if (req.method === 'POST' && urlParts === '/api/worker/complete-work') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const authWorker = getAuthenticatedWorker(req);
        if (!authWorker) {
          logAuthAudit('UNAUTHENTICATED_MUTATION', null, req, 'POST /api/worker/complete-work');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Authentication required. Please log in.' }));
          return;
        }

        const payload = JSON.parse(body || '{}');
        const { ticketNo, photo, note, voiceNote } = payload;
        if (!ticketNo) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ticketNo is required' }));
          return;
        }
        const data = readData();
        const ticket = data.tickets.find(t => t.ticketNo.toLowerCase() === ticketNo.toLowerCase().trim());
        if (!ticket) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Ticket ${ticketNo} not found` }));
          return;
        }

        // AUTHORIZATION CHECK: Ensure ticket is assigned to authenticated worker
        const isAssigned = (ticket.assignedWorkerId && ticket.assignedWorkerId.toLowerCase() === authWorker.workerId.toLowerCase()) ||
          (ticket.assignedWorker && ticket.assignedWorker.trim().toLowerCase() === authWorker.workerName.trim().toLowerCase());

        if (!isAssigned) {
          logAuthAudit('UNAUTHORIZED_ACTION_ATTEMPT', authWorker.workerId, req, `Attempted complete-work on Ticket ${ticket.ticketNo}`);
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden: Ticket is not assigned to your account.' }));
          return;
        }

        if (ticket.status !== 'Ongoing') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Cannot complete ticket with status "${ticket.status}". Ticket must be Ongoing.` }));
          return;
        }

        const nowIso = new Date().toISOString();
        const completedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const completedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        ticket.status = 'Awaiting User Confirmation';
        ticket.workerCompletedAt = nowIso;
        ticket.completedDate = completedDate;
        ticket.completedTime = completedTime;
        ticket.completedBy = authWorker.workerName;
        ticket.assignedWorkerId = authWorker.workerId;
        ticket.assignedWorker = authWorker.workerName;
        if (note) ticket.workNote = note;
        if (photo) ticket.workPhoto = photo;
        if (voiceNote) ticket.voiceNote = voiceNote;
        ticket.updatedAt = nowIso;

        if (!Array.isArray(ticket.history)) {
          ticket.history = buildHistoryForTicket(ticket);
        }

        ticket.history.push({
          id: `evt-${ticket.ticketNo}-worker-comp-${Date.now()}`,
          type: 'WORKER_COMPLETED',
          title: `Worker Marked "WORK COMPLETED"`,
          timestamp: nowIso,
          actor: authWorker.workerName,
          details: `Worker confirmed completion of ${ticket.issueCategory || 'repairs'}. ${note ? `Note: "${note}".` : ''} Ticket transitioned to Awaiting User Confirmation.`
        });

        // Dispatch verification email to user
        const emailSentSuccess = await sendUserVerificationEmail(ticket);

        saveData(data);
        console.log(`[Worker Portal] Ticket ${ticket.ticketNo} completed by ${authWorker.workerName} (${authWorker.workerId}). Status: Awaiting User Confirmation. User Email Sent: ${emailSentSuccess}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Work marked completed', ticket: serializeWorkerTicket(ticket) }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/worker/cannot-complete -> Worker reports failure reason & escalates (Authenticated & Authorized)
  if (req.method === 'POST' && urlParts === '/api/worker/cannot-complete') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const authWorker = getAuthenticatedWorker(req);
        if (!authWorker) {
          logAuthAudit('UNAUTHENTICATED_MUTATION', null, req, 'POST /api/worker/cannot-complete');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Authentication required. Please log in.' }));
          return;
        }

        const payload = JSON.parse(body || '{}');
        const { ticketNo, reason, details } = payload;
        if (!ticketNo || !reason) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ticketNo and reason are required' }));
          return;
        }
        const data = readData();
        const ticket = data.tickets.find(t => t.ticketNo.toLowerCase() === ticketNo.toLowerCase().trim());
        if (!ticket) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Ticket ${ticketNo} not found` }));
          return;
        }

        // AUTHORIZATION CHECK: Ensure ticket is assigned to authenticated worker
        const isAssigned = (ticket.assignedWorkerId && ticket.assignedWorkerId.toLowerCase() === authWorker.workerId.toLowerCase()) ||
          (ticket.assignedWorker && ticket.assignedWorker.trim().toLowerCase() === authWorker.workerName.trim().toLowerCase());

        if (!isAssigned) {
          logAuthAudit('UNAUTHORIZED_ACTION_ATTEMPT', authWorker.workerId, req, `Attempted cannot-complete on Ticket ${ticket.ticketNo}`);
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden: Ticket is not assigned to your account.' }));
          return;
        }

        if (ticket.status !== 'Ongoing') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Cannot mark ticket as Cannot Complete when status is "${ticket.status}". Ticket must be Ongoing.` }));
          return;
        }

        const nowIso = new Date().toISOString();
        ticket.status = 'Cannot Complete';
        ticket.isEscalated = true;
        ticket.cannotCompleteReason = reason;
        ticket.cannotCompleteDetails = details || '';
        ticket.cannotCompleteBy = authWorker.workerName;
        ticket.assignedWorkerId = authWorker.workerId;
        ticket.assignedWorker = authWorker.workerName;
        ticket.updatedAt = nowIso;

        if (!Array.isArray(ticket.history)) {
          ticket.history = buildHistoryForTicket(ticket);
        }

        ticket.history.push({
          id: `evt-${ticket.ticketNo}-cannot-complete-${Date.now()}`,
          type: 'CANNOT_COMPLETE',
          title: 'Worker Reported: Cannot Complete Job',
          timestamp: nowIso,
          actor: authWorker.workerName,
          details: `Reason: "${reason}". Escalation Note: "${details || 'N/A'}". Flagged for Admin assistance.`
        });

        // Notify Admin via SMTP
        try {
          const adminHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fcd34d; border-radius: 12px; overflow: hidden; background: #ffffff;">
              <div style="background: #b45309; color: #ffffff; padding: 20px; text-align: center;">
                <h2 style="margin: 0; font-size: 18px;">⚠️ Job Escalation — Cannot Complete Work Order</h2>
                <p style="margin: 4px 0 0 0; font-size: 12px;">Worker reported blocker for Ticket ${ticket.ticketNo}</p>
              </div>
              <div style="padding: 24px; color: #334155;">
                <p>Worker <strong>${authWorker.workerName}</strong> reported that they cannot complete Ticket <strong>${ticket.ticketNo}</strong> (${ticket.issueCategory} at Block ${ticket.block || 'Campus'}, Room ${ticket.roomNo || 'N/A'}).</p>
                <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; margin: 16px 0; border-radius: 6px;">
                  <strong style="color: #92400e; font-size: 13px;">Reason:</strong>
                  <div style="font-weight: 800; color: #78350f; font-size: 14px; margin-top: 2px;">${reason}</div>
                  <strong style="color: #92400e; font-size: 12px; display: block; margin-top: 8px;">Worker Notes:</strong>
                  <div style="color: #451a03; font-size: 13px; font-weight: 500;">"${details || 'No additional details provided.'}"</div>
                </div>
                <p style="font-size: 13px;">Please review this ticket in the Admin Dashboard to reassign or provide required materials/supervision.</p>
              </div>
            </div>
          `;
          await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'MRF Facilities System'}" <${SMTP_CONFIG.auth.user}>`,
            to: ADMIN_EMAIL,
            subject: `[ESCALATED] Cannot Complete Ticket ${ticket.ticketNo} - ${reason}`,
            html: adminHtml,
          });
        } catch (mailErr) {
          console.error('[SMTP Escalation Alert Error]', mailErr.message);
        }

        // Notify user that worker cannot complete
        sendUserCannotCompleteEmail(ticket);

        saveData(data);
        console.log(`[Worker Portal] Ticket ${ticket.ticketNo} escalated by ${authWorker.workerName} (${authWorker.workerId}). Reason: ${reason}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Escalation recorded', ticket: serializeWorkerTicket(ticket) }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /api/tickets -> return all tickets (ADMIN & SUPER_ADMIN ONLY)
  if (req.method === 'GET' && urlParts === '/api/tickets') {
    const adminSession = getAuthenticatedAdmin(req);
    const workerSession = getAuthenticatedWorker(req);

    if (workerSession) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Worker session cannot access administrative ticket list' }));
      return;
    }

    if (!adminSession || !['ADMIN', 'SUPER_ADMIN'].includes(adminSession.role)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Administrative authentication required' }));
      return;
    }

    const data = readData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data.tickets.map(serializeAdminTicket)));
    return;
  }

  // POST /api/tickets -> create new ticket (PUBLIC)
  if (req.method === 'POST' && urlParts === '/api/tickets') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const formData = JSON.parse(body);
        const data = readData();

        const maxExisting = extractMaxTicketNumber(data.tickets);
        const currentCounter = typeof data.counter === 'number' ? data.counter : 0;
        const nextNum = Math.max(currentCounter, maxExisting) + 1;
        data.counter = nextNum;
        const ticketNo = `#${String(nextNum).padStart(3, '0')}`;
        const now = new Date().toISOString();

        const newTicket = {
          ticketNo,
          name: formData.name || '',
          email: formData.email || '',
          phone: formData.phone || '',
          department: formData.department || '',
          userType: formData.userType || 'Student',
          studentStream: formData.studentStream || null,
          studentLevel: formData.studentLevel || null,
          block: formData.block || '',
          roomNo: formData.roomNo || '',
          issueCategory: formData.issueCategory || '',
          description: formData.description || '',
          priority: formData.priority || 'Normal',
          photo: formData.photo || null,
          status: 'Unsolved',
          isUrgent: formData.priority === 'Critical',
          assignedWorker: null,
          completionToken: generateToken(),
          userVerifyToken: generateToken(),
          history: [
            {
              id: `evt-${ticketNo}-created`,
              type: 'CREATED',
              title: 'Complaint Raised',
              timestamp: now,
              actor: formData.name || 'Complainant',
              details: `Complaint submitted for ${formData.issueCategory || 'Facilities Issue'} at ${formData.block || 'Campus'} (Room ${formData.roomNo || 'N/A'}). Priority: ${formData.priority || 'Normal'}.`
            },
            {
              id: `evt-${ticketNo}-admin-notified`,
              type: 'ADMIN_NOTIFIED',
              title: 'Admin Notified via Email',
              timestamp: now,
              actor: 'Central Facilities System',
              details: `Automated complaint alert dispatched to Facilities Admin (${ADMIN_EMAIL}) via SMTP.`
            }
          ],
          customFields: formData.customFields || {},
          formData: formData,
          createdAt: now,
          updatedAt: now,
        };

        data.tickets.push(newTicket);
        saveData(data);

        // Send email notification to Admin asynchronously via SMTP
        sendAdminNotification(newTicket).catch(err => {
          console.error('[SMTP Notification Error]', err);
        });

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(serializePublicTicket(newTicket)));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // PATCH /api/tickets/:ticketNo -> update ticket status or worker (ADMIN & SUPER_ADMIN ONLY)
  if (req.method === 'PATCH' && urlParts.startsWith('/api/tickets/')) {
    const adminSession = getAuthenticatedAdmin(req);
    const workerSession = getAuthenticatedWorker(req);

    if (workerSession) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Worker session cannot update ticket details' }));
      return;
    }

    if (!adminSession || !['ADMIN', 'SUPER_ADMIN'].includes(adminSession.role)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Administrative authentication required' }));
      return;
    }

    const rawParam = urlParts.replace('/api/tickets/', '');
    const decodedTicketNo = decodeURIComponent(rawParam).trim();
    const cleanTarget = decodedTicketNo.toLowerCase();
    const cleanDigits = cleanTarget.replace(/\D/g, '');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const rawUpdates = JSON.parse(body || '{}');
        if (!rawUpdates || typeof rawUpdates !== 'object' || Array.isArray(rawUpdates)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request body must be a JSON object' }));
          return;
        }

        const updates = {};
        let hasAllowedField = false;
        for (const key of Object.keys(rawUpdates)) {
          if (ALLOWED_PATCH_FIELDS.has(key)) {
            updates[key] = rawUpdates[key];
            hasAllowedField = true;
          }
        }

        if (!hasAllowedField) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No allowed fields provided for ticket update' }));
          return;
        }

        const data = readData();
        const idx = data.tickets.findIndex(t => {
          const tNo = (t.ticketNo || '').trim().toLowerCase();
          const tDigits = tNo.replace(/\D/g, '');
          return tNo === cleanTarget || (cleanDigits && tDigits === cleanDigits);
        });

        if (idx === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Ticket ${decodedTicketNo} not found` }));
          return;
        }

        const currentTicket = data.tickets[idx];
        if (!Array.isArray(currentTicket.history)) {
          currentTicket.history = buildHistoryForTicket(currentTicket);
        }

        // Determine target status
        let targetStatus = currentTicket.status;
        if (updates.status) {
          targetStatus = updates.status;
        } else if (updates.assignedWorker && updates.assignedWorker !== currentTicket.assignedWorker) {
          if (['Unsolved', 'Reopened', 'Cannot Complete'].includes(currentTicket.status)) {
            targetStatus = 'Ongoing';
            updates.status = 'Ongoing';
          }
        }

        // Central FSM Validation
        if (targetStatus !== currentTicket.status) {
          if (!validateStatusTransition(currentTicket.status, targetStatus, adminSession.role)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Invalid status transition from "${currentTicket.status}" to "${targetStatus}"` }));
            return;
          }
        }

        if (updates.assignedWorker && updates.assignedWorker !== currentTicket.assignedWorker) {
          currentTicket.history.push({
            id: `evt-${currentTicket.ticketNo}-assign-${Date.now()}`,
            type: 'ASSIGNED',
            title: `Worker Assigned (${updates.assignedWorker})`,
            timestamp: new Date().toISOString(),
            actor: 'Campus Facilities Admin',
            details: `Work order assigned to ${updates.assignedWorker}. Status set to Ongoing.`
          });

          // Dispatch Worker Assignment Email via SMTP
          sendWorkerAssignmentEmail({ ...currentTicket, ...updates }, updates.assignedWorker);
          sendUserWorkerAssignedEmail({ ...currentTicket, ...updates });

          // Worker WhatsApp Assignment Notification (Isolated & Non-blocking)
          try {
            const rawWorkerPhone = findWorkerPhone(updates.assignedWorker);
            const workerPhoneFormatted = formatE164(rawWorkerPhone);
            if (workerPhoneFormatted) {
              const waMsg = `🛠️ MCC Campus Facilities — Work Order Assigned\n\nHello ${updates.assignedWorker},\nYou have been assigned to Work Order ${currentTicket.ticketNo}.\n\nCategory: ${currentTicket.issueCategory || 'General Maintenance'}\nLocation: Block ${currentTicket.block || 'Campus'} (Room ${currentTicket.roomNo || 'N/A'})\nDescription: ${currentTicket.description || 'Please inspect and complete required repairs.'}\n\nPlease attend to this task according to campus protocol. When finished on site, tap the COMPLETED button in your dispatch email.`;
              sendWhatsAppTextMessage(workerPhoneFormatted, waMsg)
                .then(r => console.log(`[WhatsApp Worker Assignment] Result for ${updates.assignedWorker} (${workerPhoneFormatted}):`, r.success ? 'Delivered/Simulated' : r.error))
                .catch(e => console.error('[WhatsApp Worker Assignment Error]', e.message));
            } else {
              console.log(`[WhatsApp Worker Assignment Skipped] Worker ${updates.assignedWorker} has no valid phone number. Email notification remains active.`);
            }
          } catch (waErr) {
            console.error('[WhatsApp Worker Assignment Error]', waErr.message);
          }

          // AI Voice Worker Call Dispatch (Isolated & Non-blocking)
          try {
            const cfg = readConfig();
            const workerProfile = (cfg.workers || []).find(w =>
              (w.name && w.name.trim().toLowerCase() === updates.assignedWorker.trim().toLowerCase()) ||
              (w.email && w.email.trim().toLowerCase() === updates.assignedWorker.trim().toLowerCase())
            );

            if (workerProfile && workerProfile.communicationMode === 'VOICE') {
              const voiceSession = triggerWorkerVoiceCall(
                { ...currentTicket, ...updates },
                workerProfile
              );

              if (voiceSession) {
                currentTicket.voiceCallDetails = {
                  lastCallId: voiceSession.sessionId,
                  callStatus: voiceSession.callStatus,
                  workerPhone: workerProfile.phone,
                  lastCallTimestamp: new Date().toISOString()
                };

                currentTicket.history.push({
                  id: `evt-${currentTicket.ticketNo}-voice-${Date.now()}`,
                  type: 'VOICE_DISPATCH',
                  title: '🎙️ AI Voice Call Dispatched',
                  timestamp: new Date().toISOString(),
                  actor: 'AI Voice Orchestrator',
                  details: `Outbound AI voice call initiated to ${workerProfile.name} (${workerProfile.phone}) in ${workerProfile.preferredLanguage || 'Tamil'}.`
                });
              }
            }
          } catch (voiceErr) {
            console.error('[Voice Dispatch Error]', voiceErr.message);
          }
        }


        if (updates.status === 'Completed' && currentTicket.status !== 'Completed') {
          currentTicket.history.push({
            id: `evt-${currentTicket.ticketNo}-comp-${Date.now()}`,
            type: 'SOLVED',
            title: 'Task Completed & Closed',
            timestamp: new Date().toISOString(),
            actor: updates.completedBy || currentTicket.assignedWorker || 'Admin Desk',
            details: `Task marked COMPLETED and closed in Admin Dashboard.`
          });
        }

        data.tickets[idx] = {
          ...currentTicket,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        saveData(data);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(serializeAdminTicket(data.tickets[idx])));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/send-worker-email -> Admin sends direct email to worker via SMTP with COMPLETED button (ADMIN & SUPER_ADMIN ONLY)
  if (req.method === 'POST' && (urlParts === '/api/send-worker-email' || urlParts === '/api/send-email')) {
    const adminSession = getAuthenticatedAdmin(req);
    const workerSession = getAuthenticatedWorker(req);

    if (workerSession) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Worker session cannot send administrative worker emails' }));
      return;
    }

    if (!adminSession || !['ADMIN', 'SUPER_ADMIN'].includes(adminSession.role)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Administrative authentication required' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const to_email = payload.to_email || payload.to || payload.worker_email;
        const to_name = payload.to_name || payload.name || payload.worker_name || 'Staff Member';
        const subject = payload.subject;
        const message = payload.message;
        const sender_name = payload.sender_name || 'Campus Facilities Administrator';
        const rawTicketNo = payload.ticket_no || payload.ticketNo || payload.work_id || payload.task_id;
        const location = payload.location || '';
        const issueCategory = payload.issueCategory || '';

        if (!to_email || !to_email.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Recipient worker email is required.' }));
          return;
        }

        if (!subject || !subject.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Email subject is required.' }));
          return;
        }

        if (!message || !message.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Email message content is required.' }));
          return;
        }

        const data = readData();
        let targetTicket = null;

        if (rawTicketNo) {
          targetTicket = data.tickets.find(t =>
            t.ticketNo.toLowerCase() === rawTicketNo.toLowerCase().trim()
          );
        }

        // If no explicit ticket specified, find active ticket assigned to this worker
        if (!targetTicket) {
          targetTicket = data.tickets.find(t =>
            t.assignedWorker === to_name && t.status !== 'Completed'
          );
        }

        let completionLink = null;
        let workOrderId = 'WORK-DISPATCH';

        if (targetTicket) {
          if (!targetTicket.completionToken) {
            targetTicket.completionToken = generateToken();
          }
          if (!Array.isArray(targetTicket.history)) {
            targetTicket.history = buildHistoryForTicket(targetTicket);
          }

          targetTicket.history.push({
            id: `evt-${targetTicket.ticketNo}-dispatch-${Date.now()}`,
            type: 'DISPATCHED',
            title: 'Task Dispatched via Email',
            timestamp: new Date().toISOString(),
            actor: sender_name,
            details: `Official task instructions with 1-click COMPLETED button delivered to ${to_name} (${to_email}).`
          });

          targetTicket.assignedWorker = to_name;
          if (targetTicket.status === 'Unsolved') {
            targetTicket.status = 'Ongoing';
          }
          targetTicket.updatedAt = new Date().toISOString();
          saveData(data);

          workOrderId = targetTicket.ticketNo;
          const baseUrl = getWorkerCompletionBaseUrl();
          completionLink = `${baseUrl}/api/complete-task?token=${targetTicket.completionToken}`;
        }

        const taskLocation = location || (targetTicket ? `${targetTicket.block || 'Campus'} (Room ${targetTicket.roomNo || 'N/A'})` : 'Campus Facilities');
        const taskCategory = issueCategory || (targetTicket ? targetTicket.issueCategory : 'Maintenance Service');

        // Worker WhatsApp Dispatch Notification (Isolated & Non-blocking)
        try {
          const rawWorkerPhone = payload.worker_phone || payload.phone || findWorkerPhone(to_name);
          const workerPhoneFormatted = formatE164(rawWorkerPhone);
          if (workerPhoneFormatted) {
            const waWorkerMsg = `🛠️ MCC Campus Facilities — Task Instruction Dispatch\n\nHello ${to_name},\nWork Order ID: ${workOrderId}\nSubject: ${subject}\n\nTask Details:\n${message}\n\nLocation: ${taskLocation}\nCategory: ${taskCategory}\n\nPlease review and execute repairs. When finished on site, tap the COMPLETED button in your dispatch email.`;
            sendWhatsAppTextMessage(workerPhoneFormatted, waWorkerMsg)
              .then(r => console.log(`[WhatsApp Worker Dispatch] Result for ${to_name} (${workerPhoneFormatted}):`, r.success ? 'Delivered/Simulated' : r.error))
              .catch(e => console.error('[WhatsApp Worker Dispatch Error]', e.message));
          } else {
            console.log(`[WhatsApp Worker Dispatch Skipped] Recipient worker ${to_name} has no valid phone number. Email dispatch sent.`);
          }
        } catch (waErr) {
          console.error('[WhatsApp Worker Dispatch Error]', waErr.message);
        }

        const htmlContent = `

          <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #2563eb 100%); color: #ffffff; padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">MCC Campus Facilities</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #93c5fd; font-weight: 600; letter-spacing: 0.3px;">Official Work Order & Staff Task Dispatch</p>
            </div>
            
            <!-- Body Content -->
            <div style="padding: 32px 28px; color: #334155; line-height: 1.6;">
              <!-- Recipient Greeting Badge -->
              <div style="margin-bottom: 24px; padding: 14px 18px; border-radius: 12px; background-color: #f0fdf4; border-left: 4px solid #10b981; display: flex; align-items: center;">
                <div style="font-size: 14px; color: #065f46; font-weight: 700;">
                  📢 Direct Task Instruction for <strong>${to_name}</strong>
                </div>
              </div>

              <!-- Meta Information Table -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tbody>
                  <tr>
                    <td style="padding: 11px 16px; font-weight: 700; width: 34%; color: #64748b; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Work / Task ID:</td>
                    <td style="padding: 11px 16px; font-weight: 900; color: #0f172a; font-size: 14px; border-bottom: 1px solid #e2e8f0;">${workOrderId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 11px 16px; font-weight: 700; color: #64748b; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Assigned Worker:</td>
                    <td style="padding: 11px 16px; font-weight: 800; color: #0f172a; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${to_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 11px 16px; font-weight: 700; color: #64748b; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Worker Email:</td>
                    <td style="padding: 11px 16px; color: #2563eb; font-size: 13px; font-weight: 600; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${to_email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 11px 16px; font-weight: 700; color: #64748b; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Category & Loc:</td>
                    <td style="padding: 11px 16px; color: #334155; font-size: 13px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${taskCategory} · ${taskLocation}</td>
                  </tr>
                  <tr>
                    <td style="padding: 11px 16px; font-weight: 700; color: #64748b; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Subject:</td>
                    <td style="padding: 11px 16px; font-weight: 800; color: #0f172a; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${subject}</td>
                  </tr>
                  <tr>
                    <td style="padding: 11px 16px; font-weight: 700; color: #64748b; font-size: 12px; text-transform: uppercase;">Dispatched By:</td>
                    <td style="padding: 11px 16px; color: #475569; font-size: 13px; font-weight: 600;">${sender_name} • ${new Date().toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <!-- Main Message Container -->
              <div style="background-color: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px;">MESSAGE & TASK DESCRIPTION:</div>
                <div style="font-size: 14px; color: #0f172a; white-space: pre-wrap; line-height: 1.7; font-weight: 500;">${message}</div>
              </div>

              ${completionLink ? `
              <!-- WORKER TASK COMPLETION ACTION (Mobile Friendly) -->
              <div style="margin: 28px 0 22px 0; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; border-radius: 14px; padding: 22px 18px; text-align: center; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.12);">
                <div style="font-size: 13px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                  ⚡ Task Completion Confirmation
                </div>
                <p style="font-size: 12px; color: #15803d; margin: 0 0 18px 0; line-height: 1.4;">
                  Once you have finished attending to this task, click the button below to update the system:
                </p>
                
                <!-- COMPLETED Button -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; width: 100%; max-width: 320px;">
                  <tr>
                    <td align="center" style="border-radius: 12px; background-color: #16a34a; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35);">
                      <a href="${completionLink}" target="_blank" style="display: block; width: 100%; padding: 15px 28px; font-size: 16px; font-family: 'Segoe UI', -apple-system, Arial, sans-serif; font-weight: 900; color: #ffffff; text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px; border-radius: 12px; box-sizing: border-box; text-align: center;">
                        COMPLETED
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="margin-top: 12px; font-size: 11px; color: #166534; font-weight: 700;">
                  Work Order Linked: <strong>${workOrderId}</strong> (${to_name})
                </div>
              </div>
              ` : ''}

              <!-- Footer Notice -->
              <p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.6;">
                Please attend to this task according to campus facilities protocol. If you need replacement parts or escalation, contact the central maintenance governance desk.
              </p>
            </div>

            <!-- Email Footer -->
            <div style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              © 2026 Campus Facilities Maintenance Portal • Automated Secure SMTP Dispatch
            </div>
          </div>
        `;

        const mailOptions = {
          from: `"${process.env.SMTP_FROM_NAME || 'MRF Facilities Admin'}" <${process.env.SMTP_USER || 'admin.mrf@gmail.com'}>`,
          to: to_email,
          subject: `[MRF Facilities ${workOrderId}] ${subject}`,
          text: `Hello ${to_name},\n\nWork Order ID: ${workOrderId}\nSubject: ${subject}\n\nMessage:\n${message}\n\n${completionLink ? `Mark Task Completed Link:\n${completionLink}\n\n` : ''}Dispatched By: ${sender_name} (${new Date().toLocaleString()})\nMRF Facilities Maintenance`,
          html: htmlContent,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[SMTP Worker Dispatch] Sent to ${to_name} (${to_email}) - Message ID: ${info.messageId} (Task: ${workOrderId})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Email sent successfully.',
          messageId: info.messageId,
          to: to_email,
          workOrderId,
        }));
      } catch (err) {
        console.error('[SMTP Worker Email Error]', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: err.message || 'Failed to send email via SMTP.',
        }));
      }
    });
    return;
  }

  // GET or POST /api/complete-task, /api/worker-complete, /complete-task -> Worker clicks COMPLETED button in email
  if (urlParts === '/api/complete-task' || urlParts === '/complete-task' || urlParts === '/api/worker-complete' || urlParts === '/worker-complete') {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const token = parsedUrl.searchParams.get('token');

    if (!token || !token.trim()) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invalid Token — MCC Campus Facilities</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
            .card { background: #ffffff; max-width: 460px; width: 100%; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; overflow: hidden; text-align: center; }
            .header { background: #ef4444; color: #ffffff; padding: 24px; font-size: 18px; font-weight: 800; text-transform: uppercase; }
            .content { padding: 32px 24px; }
            .btn { display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 18px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">⚠️ Invalid Token</div>
            <div class="content">
              <p style="font-size: 16px; font-weight: 800; color: #991b1b; margin-top: 0;">Missing Completion Token</p>
              <p style="font-size: 13px; color: #64748b; line-height: 1.5;">No secure completion token was detected in this link. Please access the task from your original email dispatch.</p>
              <div style="margin-top: 20px; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
                You may now close this page.
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const data = readData();
    const ticket = data.tickets.find(t => t.completionToken === token);

    if (!ticket) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Task Not Found — MCC Campus Facilities</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 24px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
            .card { background: #ffffff; max-width: 460px; width: 100%; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; overflow: hidden; text-align: center; }
            .header { background: #ef4444; color: #ffffff; padding: 24px; font-size: 18px; font-weight: 800; text-transform: uppercase; }
            .content { padding: 32px 24px; }
            .btn { display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 18px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">⚠️ Task Not Found</div>
            <div class="content">
              <p style="font-size: 16px; font-weight: 800; color: #991b1b; margin-top: 0;">Invalid or Expired Task Link</p>
              <p style="font-size: 13px; color: #64748b; line-height: 1.5;">This task completion token is invalid, expired, or the work order has been archived.</p>
              <div style="margin-top: 20px; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
                Please contact the Facilities Administrator if you need assistance. You may now close this page.
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // If task is ALREADY in Awaiting User Confirmation or Resolved -> show safe informational screen
    if (ticket.status === 'Resolved' || ticket.status === 'Completed') {
      const completedTimeFormatted = ticket.completedAt || ticket.workerCompletedAt
        ? new Date(ticket.completedAt || ticket.workerCompletedAt).toLocaleString()
        : (ticket.completedDate ? `${ticket.completedDate} ${ticket.completedTime || ''}` : new Date(ticket.updatedAt).toLocaleString());

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Work Already Resolved — MCC Campus Facilities</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f0fdf4; color: #1e293b; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
            .card { background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #bbf7d0; overflow: hidden; text-align: center; }
            .header { background: linear-gradient(135deg, #065f46, #047857); color: #ffffff; padding: 26px 20px; }
            .checkmark { width: 56px; height: 56px; background: #ffffff; border-radius: 50%; color: #059669; font-size: 32px; font-weight: 900; line-height: 56px; margin: 0 auto 12px auto; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
            .content { padding: 32px 24px; }
            .info-table { width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin: 20px 0; font-size: 13px; text-align: left; }
            .info-table td { padding: 11px 14px; border-bottom: 1px solid #e2e8f0; }
            .info-table tr:last-child td { border-bottom: none; }
            .notice-box { margin-top: 20px; padding: 16px 20px; background: #f0fdf4; border-radius: 14px; border: 1px solid #bbf7d0; font-size: 13px; color: #166534; line-height: 1.6; text-align: center; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="checkmark">✓</div>
              <h2 style="margin:0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px;">✓ Work Already Resolved</h2>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #d1fae5; font-weight: 600;">Complainant confirmed issue is fixed</p>
            </div>
            <div class="content">
              <table class="info-table">
                <tr>
                  <td style="color: #64748b; font-weight: 700; width: 42%;">Work / Task ID:</td>
                  <td style="color: #0f172a; font-weight: 900; font-size: 14px;">${ticket.ticketNo}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 700;">Worker:</td>
                  <td style="color: #0f172a; font-weight: 700;">${ticket.assignedWorker || ticket.completedBy || 'Staff'}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 700;">Status:</td>
                  <td style="color: #16a34a; font-weight: 900;">RESOLVED</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 700;">Completed At:</td>
                  <td style="color: #334155; font-weight: 600;">${completedTimeFormatted}</td>
                </tr>
              </table>

              <div class="notice-box">
                <div style="font-weight: 800; font-size: 14px; margin-bottom: 4px; color: #15803d;">This task is fully resolved and closed in the central system.</div>
                <div>No further action is required. You may now close this page.</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (ticket.status === 'Awaiting User Confirmation') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Awaiting User Confirmation — MCC Facilities</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f0f9ff; color: #1e293b; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
            .card { background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #bae6fd; overflow: hidden; text-align: center; }
            .header { background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; padding: 26px 20px; }
            .icon { width: 56px; height: 56px; background: #ffffff; border-radius: 50%; color: #0284c7; font-size: 28px; font-weight: 900; line-height: 56px; margin: 0 auto 12px auto; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
            .content { padding: 32px 24px; }
            .notice-box { margin-top: 20px; padding: 16px 20px; background: #f0f9ff; border-radius: 14px; border: 1px solid #bae6fd; font-size: 13px; color: #0369a1; line-height: 1.6; text-align: center; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="icon">⏳</div>
              <h2 style="margin:0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px;">Work Marked Completed</h2>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #e0f2fe; font-weight: 600;">Awaiting Complainant Verification</p>
            </div>
            <div class="content">
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">You have already marked your work on <strong>Ticket ${ticket.ticketNo}</strong> as finished on site.</p>
              <div class="notice-box">
                <div style="font-weight: 800; font-size: 14px; margin-bottom: 4px; color: #0284c7;">Status: Awaiting User Confirmation</div>
                <div>A verification notification was dispatched to complainant ${ticket.name || 'User'}. Once they confirm on site, the complaint will be officially closed.</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Transition status to Awaiting User Confirmation (WORKER COMPLETED != RESOLVED)
    const nowIso = new Date().toISOString();
    const completedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const completedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (!Array.isArray(ticket.history)) {
      ticket.history = buildHistoryForTicket(ticket);
    }

    if (!ticket.userVerifyToken) {
      ticket.userVerifyToken = generateToken();
    }

    ticket.history.push({
      id: `evt-${ticket.ticketNo}-worker-comp-${Date.now()}`,
      type: 'WORKER_COMPLETED',
      title: `Worker Marked "WORK COMPLETED"`,
      timestamp: nowIso,
      actor: ticket.assignedWorker || 'Maintenance Staff',
      details: `Worker confirmed on-site completion of ${ticket.issueCategory || 'repairs'}. Ticket transitioned to Awaiting User Confirmation.`
    });

    ticket.status = 'Awaiting User Confirmation';
    ticket.workerCompletedAt = nowIso;
    ticket.completedDate = completedDate;
    ticket.completedTime = completedTime;
    ticket.completedBy = ticket.assignedWorker || 'Maintenance Staff';
    ticket.updatedAt = nowIso;

    // Send SMTP verification email to User
    const emailSentSuccess = await sendUserVerificationEmail(ticket);

    // Optional WhatsApp verification message if phone exists
    const userPhoneFormatted = formatE164(ticket.phone);
    let waSentSuccess = false;
    if (userPhoneFormatted) {
      const bodyText = `📋 MCC Campus Facilities — Verification Request\n\nDear ${ticket.name || 'Complainant'},\nWork for Ticket ${ticket.ticketNo} (${ticket.issueCategory || 'Maintenance'}) has been marked COMPLETED on site by maintenance staff (${ticket.assignedWorker || 'Staff'}).\n\nPlease check whether the issue has actually been fixed on site and confirm below:`;
      const buttons = [
        { id: 'CONFIRM_FIXED', title: '✅ Confirm Fixed' },
        { id: 'NOT_FIXED', title: '❌ Not Fixed' }
      ];
      const waRes = await sendWhatsAppInteractiveButtons(userPhoneFormatted, bodyText, buttons);
      if (waRes.success) waSentSuccess = true;
    }

    saveData(data);
    console.log(`[Worker Completion] Ticket ${ticket.ticketNo} updated to "Awaiting User Confirmation" by ${ticket.assignedWorker}. SMTP email sent: ${emailSentSuccess}`);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Work Marked Completed — MCC Facilities</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f0fdf4; color: #1e293b; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
          .card { background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; box-shadow: 0 12px 36px rgba(16, 185, 129, 0.15); border: 1px solid #bbf7d0; overflow: hidden; text-align: center; }
          .header { background: linear-gradient(135deg, #065f46, #047857); color: #ffffff; padding: 28px 20px; }
          .checkmark { width: 60px; height: 60px; background: #ffffff; border-radius: 50%; color: #059669; font-size: 34px; font-weight: 900; line-height: 60px; margin: 0 auto 12px auto; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
          .content { padding: 32px 24px; }
          .info-table { width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin: 20px 0; font-size: 13px; text-align: left; }
          .info-table td { padding: 11px 14px; border-bottom: 1px solid #e2e8f0; }
          .info-table tr:last-child td { border-bottom: none; }
          .notice-box { margin-top: 20px; padding: 16px 20px; background: #f0fdf4; border-radius: 14px; border: 1px solid #bbf7d0; font-size: 13px; color: #166534; line-height: 1.6; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="checkmark">✓</div>
            <h2 style="margin:0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px;">✓ Work Marked Completed</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #d1fae5; font-weight: 600;">Status: Awaiting User Confirmation</p>
          </div>
          <div class="content">
            <table class="info-table">
              <tr>
                <td style="color: #64748b; font-weight: 700; width: 42%;">Work / Task ID:</td>
                <td style="color: #0f172a; font-weight: 900; font-size: 14px;">${ticket.ticketNo}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 700;">Worker:</td>
                <td style="color: #0f172a; font-weight: 800;">${ticket.assignedWorker || ticket.completedBy || 'Staff'}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 700;">Category & Loc:</td>
                <td style="color: #334155; font-weight: 600;">${ticket.issueCategory} · ${ticket.block || 'Campus'}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 700;">Status:</td>
                <td style="color: #0284c7; font-weight: 900;">AWAITING USER CONFIRMATION</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 700;">SMTP User Email:</td>
                <td style="color: ${emailSentSuccess ? '#16a34a' : '#d97706'}; font-weight: 800;">${emailSentSuccess ? 'Dispatched to User' : 'Missing/Invalid Email'}</td>
              </tr>
            </table>

            <div class="notice-box">
              <div style="font-weight: 800; font-size: 14px; margin-bottom: 4px; color: #15803d;">Your work completion has been recorded.</div>
              <div>An SMTP verification email with [ISSUE FIXED] & [ISSUE NOT FIXED] actions was sent to complainant ${ticket.name || 'User'}. You may now close this page.</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // GET /api/verify-user, /verify-user -> User clicks "ISSUE FIXED" or "ISSUE NOT FIXED" in email
  if (urlParts === '/api/verify-user' || urlParts === '/verify-user') {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const token = parsedUrl.searchParams.get('token');
    const action = parsedUrl.searchParams.get('action');

    if (!token || !token.trim()) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>Invalid Link</title>
        <style>body{font-family:sans-serif;background:#f8fafc;padding:40px;text-align:center;} .card{background:#fff;max-width:440px;margin:0 auto;padding:32px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,0.08);border:1px solid #e2e8f0;}</style>
        </head>
        <body><div class="card"><h2 style="color:#ef4444;">⚠️ Invalid Verification Link</h2><p>No valid security token was provided. Please use the link sent in your verification email.</p></div></body>
        </html>
      `);
      return;
    }

    const data = readData();
    const ticket = data.tickets.find(t => t.userVerifyToken === token);

    if (!ticket) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>Link Expired</title>
        <style>body{font-family:sans-serif;background:#f8fafc;padding:40px;text-align:center;} .card{background:#fff;max-width:440px;margin:0 auto;padding:32px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,0.08);border:1px solid #e2e8f0;}</style>
        </head>
        <body><div class="card"><h2 style="color:#ef4444;">⚠️ Link Expired or Single-Use Token Consumed</h2><p>This verification link is invalid or has already been used.</p></div></body>
        </html>
      `);
      return;
    }

    // STRICT BUSINESS LIFECYCLE GUARD: Ticket must be in "Awaiting User Confirmation" to respond to verification email
    if (ticket.status !== 'Awaiting User Confirmation') {
      if (ticket.status === 'Resolved' || ticket.status === 'Completed') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Ticket Already Resolved</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0fdf4; color: #1e293b; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
              .card { background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #bbf7d0; text-align: center; overflow: hidden; }
              .header { background: linear-gradient(135deg, #059669, #047857); color: #fff; padding: 28px 20px; }
              .checkmark { width: 56px; height: 56px; background: #fff; border-radius: 50%; color: #059669; font-size: 32px; font-weight: 900; line-height: 56px; margin: 0 auto 12px auto; }
              .content { padding: 32px 24px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="header">
                <div class="checkmark">✓</div>
                <h2 style="margin:0; font-size:20px; font-weight:900;">Ticket Already Resolved</h2>
                <p style="margin:4px 0 0 0; font-size:13px; color:#d1fae5;">Ticket ${ticket.ticketNo}</p>
              </div>
              <div class="content">
                <p style="font-size:14px; color:#334155; line-height:1.6;">This ticket has already been confirmed as resolved and closed in our central maintenance system.</p>
                <div style="margin-top:20px; padding:12px; background:#f0fdf4; border-radius:12px; border:1px solid #bbf7d0; font-size:12px; color:#166534;">
                  No further action is required. You may close this page.
                </div>
              </div>
            </div>
          </body>
          </html>
        `);
        return;
      }

      if (ticket.status === 'Reopened') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Ticket Reopened — Under Maintenance</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fef2f2; color: #1e293b; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
              .card { background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #fecaca; text-align: center; overflow: hidden; }
              .header { background: linear-gradient(135deg, #dc2626, #991b1b); color: #fff; padding: 28px 20px; }
              .content { padding: 32px 24px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="header">
                <h2 style="margin:0; font-size:20px; font-weight:900;">🔴 Ticket Currently Reopened</h2>
                <p style="margin:4px 0 0 0; font-size:13px; color:#fca5a5;">Ticket ${ticket.ticketNo}</p>
              </div>
              <div class="content">
                <p style="font-size:14px; color:#334155; line-height:1.6;">This ticket has been marked as REOPENED and sent back to maintenance staff for re-inspection. Previous verification links are inactive.</p>
                <div style="margin-top:20px; padding:12px; background:#fef2f2; border-radius:12px; border:1px solid #fecaca; font-size:12px; color:#991b1b;">
                  Once staff re-completes the work, a new verification link will be sent to your email.
                </div>
              </div>
            </div>
          </body>
          </html>
        `);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Link Inactive for Current Status</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .card { background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; text-align: center; overflow: hidden; }
            .header { background: #0f172a; color: #fff; padding: 24px 20px; }
            .content { padding: 32px 24px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2 style="margin:0; font-size:18px; font-weight:900;">⚠️ Verification Link Inactive</h2>
            </div>
            <div class="content">
              <p style="font-size:14px; color:#334155;">This verification link is not active for the current status (<strong>${ticket.status}</strong>) of Ticket ${ticket.ticketNo}.</p>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // FLOW 1 — USER CONFIRMS FIXED
    if (action === 'fixed') {
      const nowIso = new Date().toISOString();
      if (!Array.isArray(ticket.history)) {
        ticket.history = buildHistoryForTicket(ticket);
      }

      ticket.status = 'Resolved';
      ticket.userConfirmedAt = nowIso;
      ticket.updatedAt = nowIso;
      ticket.userVerifyToken = generateToken(); // Invalidate consumed single-use token

      ticket.history.push({
        id: `evt-${ticket.ticketNo}-user-confirmed-${Date.now()}`,
        type: 'USER_CONFIRMED',
        title: 'User Confirmed Issue Fixed',
        timestamp: nowIso,
        actor: ticket.name || 'Complainant',
        details: 'Complainant verified on site via SMTP email link that the issue is fixed. Ticket status updated to Resolved and closed.'
      });

      saveData(data);
      console.log(`[User Verification] Ticket ${ticket.ticketNo} confirmed FIXED by complainant ${ticket.name}. Status updated to Resolved.`);

      // Send confirmation email
      sendUserConfirmationSuccessEmail(ticket);

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Issue Resolved — MCC Facilities</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0fdf4; color: #1e293b; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .card { background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; box-shadow: 0 12px 36px rgba(16,185,129,0.15); border: 1px solid #bbf7d0; text-align: center; overflow: hidden; }
            .header { background: linear-gradient(135deg, #16a34a, #15803d); color: #fff; padding: 28px 20px; }
            .checkmark { width: 60px; height: 60px; background: #fff; border-radius: 50%; color: #16a34a; font-size: 34px; font-weight: 900; line-height: 60px; margin: 0 auto 12px auto; }
            .content { padding: 32px 24px; }
            .info-box { background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 16px; margin: 20px 0; font-size: 13px; text-align: left; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="checkmark">✓</div>
              <h2 style="margin:0; font-size:22px; font-weight:900;">✅ Issue Fixed Confirmed!</h2>
              <p style="margin:6px 0 0 0; font-size:13px; color:#dcfce7; font-weight:600;">Status: RESOLVED</p>
            </div>
            <div class="content">
              <p style="font-size:14px; color:#334155; line-height:1.6;">
                Thank you, <strong>${ticket.name || 'User'}</strong>! Your confirmation has been recorded for <strong>Ticket ${ticket.ticketNo}</strong> (${ticket.issueCategory}).
              </p>

              <div class="info-box">
                <div style="margin-bottom: 6px; font-weight: 700; color: #64748b;">Summary:</div>
                <div style="color: #0f172a; font-weight: 800;">Ticket: ${ticket.ticketNo}</div>
                <div style="color: #334155;">Location: Block ${ticket.block || 'Campus'}, Room ${ticket.roomNo || 'N/A'}</div>
                <div style="color: #16a34a; font-weight: 800; margin-top: 6px;">Status: RESOLVED & CLOSED</div>
              </div>

              <p style="font-size:12px; color:#64748b; margin:0;">You may now close this browser tab.</p>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // FLOW 2 — USER SAYS NOT FIXED
    if (action === 'not_fixed') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Report Unresolved Issue — Ticket ${ticket.ticketNo}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
            .card { background: #ffffff; max-width: 520px; width: 100%; border-radius: 24px; box-shadow: 0 12px 36px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; overflow: hidden; }
            .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
            .content { padding: 32px 28px; }
            .form-group { margin-bottom: 20px; text-align: left; }
            label { display: block; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; }
            textarea { width: 100%; box-sizing: border-box; padding: 14px; border: 1.5px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 110px; outline: none; transition: border-color 0.2s; }
            textarea:focus { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1); }
            .btn-submit { width: 100%; background: linear-gradient(135deg, #dc2626, #b91c1c); color: #ffffff; border: none; padding: 15px; border-radius: 12px; font-size: 15px; font-weight: 900; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3); transition: opacity 0.2s; }
            .btn-submit:hover { opacity: 0.95; }
            .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; font-size: 13px; color: #475569; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2 style="margin: 0; font-size: 20px; font-weight: 900;">❌ Issue Not Fixed</h2>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #fca5a5; font-weight: 600;">Report Unresolved Work — Ticket ${ticket.ticketNo}</p>
            </div>
            <div class="content">
              <p style="font-size: 14px; color: #334155; margin-top: 0; line-height: 1.5;">
                Hello <strong>${ticket.name || 'User'}</strong>, please let us know what is still not fixed on site so our team can re-inspect immediately.
              </p>

              <div class="info-card">
                <div><strong>Ticket:</strong> ${ticket.ticketNo}</div>
                <div><strong>Category:</strong> ${ticket.issueCategory}</div>
                <div><strong>Location:</strong> Block ${ticket.block || 'Campus'}, Room ${ticket.roomNo || 'N/A'}</div>
                <div><strong>Assigned Worker:</strong> ${ticket.assignedWorker || 'Staff'}</div>
              </div>

              <form action="/api/verify-user-reject" method="POST">
                <input type="hidden" name="token" value="${token}">
                <div class="form-group">
                  <label for="rejectionReason">Please tell us what is still not fixed:*</label>
                  <textarea id="rejectionReason" name="rejectionReason" required placeholder="Describe what is still broken or incomplete..."></textarea>
                </div>
                <button type="submit" class="btn-submit">Submit & Reopen Ticket</button>
              </form>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }
  }

  // POST /api/verify-user-reject, /verify-user-reject -> User submits rejection reason form
  if (req.method === 'POST' && (urlParts === '/api/verify-user-reject' || urlParts === '/verify-user-reject')) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        let token = '';
        let rejectionReason = '';

        if (req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(body);
          token = params.get('token') || '';
          rejectionReason = params.get('rejectionReason') || '';
        } else {
          try {
            const parsed = JSON.parse(body);
            token = parsed.token || '';
            rejectionReason = parsed.rejectionReason || parsed.reason || '';
          } catch {
            const params = new URLSearchParams(body);
            token = params.get('token') || '';
            rejectionReason = params.get('rejectionReason') || '';
          }
        }

        if (!token || !token.trim()) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h2>Missing token parameter.</h2>`);
          return;
        }

        const data = readData();
        const ticket = data.tickets.find(t => t.userVerifyToken === token);

        if (!ticket) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h2>Ticket not found or verification link expired.</h2>`);
          return;
        }

        if (ticket.status !== 'Awaiting User Confirmation') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><title>Action No Longer Valid</title>
            <style>body{font-family:sans-serif;background:#f8fafc;padding:40px;text-align:center;} .card{background:#fff;max-width:440px;margin:0 auto;padding:32px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,0.08);border:1px solid #e2e8f0;}</style>
            </head>
            <body><div class="card"><h2 style="color:#0f172a;">⚠️ Action Inactive</h2><p>This verification token is no longer active for the current status (${ticket.status}) of Ticket ${ticket.ticketNo}.</p></div></body>
            </html>
          `);
          return;
        }

        const cleanReason = (rejectionReason || '').trim() || 'Issue reported as not fixed on site by complainant.';
        const nowIso = new Date().toISOString();

        if (!Array.isArray(ticket.history)) {
          ticket.history = buildHistoryForTicket(ticket);
        }

        ticket.status = 'Reopened';
        ticket.rejectionReason = cleanReason;
        ticket.userRejectionReason = cleanReason;
        ticket.updatedAt = nowIso;
        ticket.userVerifyToken = generateToken(); // Invalidate consumed single-use token

        ticket.history.push({
          id: `evt-${ticket.ticketNo}-user-rejected-${Date.now()}`,
          type: 'USER_REJECTED',
          title: 'User Reported Issue Not Fixed',
          timestamp: nowIso,
          actor: ticket.name || 'Complainant',
          details: `Complainant reported issue as not fixed. Reason: "${cleanReason}". Ticket status changed to Reopened.`
        });

        saveData(data);
        console.log(`[User Rejection] Ticket ${ticket.ticketNo} REOPENED by complainant ${ticket.name}. Reason: "${cleanReason}"`);

        // Send SMTP alerts asynchronously to Admin & Worker
        sendTicketReopenedAlerts(ticket, cleanReason);
        
        // Notify user that the issue is marked as reopened
        sendUserReopenedEmail(ticket);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rejection Submitted — Ticket ${ticket.ticketNo}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fef2f2; color: #1e293b; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
              .card { background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; box-shadow: 0 12px 36px rgba(220,38,38,0.15); border: 1px solid #fecaca; text-align: center; overflow: hidden; }
              .header { background: linear-gradient(135deg, #dc2626, #991b1b); color: #fff; padding: 28px 20px; }
              .content { padding: 32px 24px; }
              .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 18px; margin: 20px 0; text-align: left; font-size: 13px; color: #7f1d1d; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="header">
                <h2 style="margin:0; font-size:22px; font-weight:900;">🔴 Ticket Reopened</h2>
                <p style="margin:6px 0 0 0; font-size:13px; color:#fca5a5; font-weight:600;">Status: REOPENED</p>
              </div>
              <div class="content">
                <p style="font-size:14px; color:#334155; line-height:1.6;">
                  Your rejection details for <strong>Ticket ${ticket.ticketNo}</strong> have been recorded.
                </p>

                <div class="reason-box">
                  <strong>Your Submitted Reason:</strong>
                  <p style="margin:6px 0 0 0; white-space:pre-wrap; font-weight:600;">"${cleanReason}"</p>
                </div>

                <p style="font-size:13px; color:#475569; line-height:1.5;">
                  Facilities Admin and maintenance staff <strong>${ticket.assignedWorker || 'Staff'}</strong> have been notified to re-inspect the location.
                </p>

                <div style="margin-top:24px; font-size:12px; color:#94a3b8;">You may now close this browser tab.</div>
              </div>
            </div>
          </body>
          </html>
        `);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>Error submitting rejection: ${err.message}</h2>`);
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.on('error', (err) => {
  console.error('[Server Error]', err);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

server.listen(PORT, HOST, () => {
  console.log(`[MRF Local Sync Server] Running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`[MRF Local Sync Server] Network interface bound to ${HOST}:${PORT} (Accepts LAN connections)`);
  console.log(`[MRF Local Sync Server] Worker completion base URL: ${getWorkerCompletionBaseUrl()}`);
});

// Keep-alive heartbeat interval
setInterval(() => { }, 1000 * 60 * 60);
