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
      if (u.port === '80' || u.port === '') {
        return `${u.protocol}//${u.hostname}/issue/admin`;
      }
      return `${u.protocol}//${u.hostname}:5174/issue/admin`;
    } catch {
      // ignore
    }
  }
  return 'http://localhost:5174/issue/admin';
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

const CONFIG_FILE = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG_DATA = {
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
  // ── User Portal Control (managed by Super Admin) ──────────────
  portalActive: true,         // false = Issue Portal shows a "Portal Closed" screen
  submissionsEnabled: true,   // false = form is visible but submit button is disabled
  portalNotice: {
    enabled: false,
    message: '',
    type: 'info',             // 'info' | 'warning' | 'alert'
    lastUpdated: new Date().toISOString(),
  },
};

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG_DATA, null, 2));
      return DEFAULT_CONFIG_DATA;
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG_DATA, ...parsed };
  } catch {
    return DEFAULT_CONFIG_DATA;
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const server = http.createServer(async (req, res) => {
  // Enable CORS for all ports on localhost
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlParts = req.url.split('?')[0];

  // GET /api/system-config -> returns system config
  if (req.method === 'GET' && (urlParts === '/api/system-config' || urlParts === '/api/config')) {
    const cfg = readConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cfg));
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
    const rawParam = urlParts.replace('/api/tickets/', '').replace('/admin-override', '');
    const decodedTicketNo = decodeURIComponent(rawParam).trim();
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const adminName = payload.adminName || 'Campus Facilities Admin';
        const reason = payload.reason || 'Manual verification confirmed by Admin';

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


  // POST /api/system-config -> updates system config
  if (req.method === 'POST' && (urlParts === '/api/system-config' || urlParts === '/api/config')) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const incoming = JSON.parse(body);
        const current = readConfig();
        const mergedCfg = { ...current, ...incoming };
        saveConfig(mergedCfg);
        console.log(`[Config Updated] System configuration updated by Super Admin.`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mergedCfg));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // DELETE /api/tickets/:ticketNo -> delete ticket for Super Admin
  if (req.method === 'DELETE' && urlParts.startsWith('/api/tickets/')) {
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
    res.end(JSON.stringify({ success: true, deleted, remainingCount: data.tickets.length }));
    return;
  }

  // GET /api/tickets -> return all tickets
  if (req.method === 'GET' && urlParts === '/api/tickets') {
    const data = readData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data.tickets));
    return;
  }

  // POST /api/tickets -> create new ticket
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
        res.end(JSON.stringify(newTicket));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // PATCH /api/tickets/:ticketNo -> update ticket status or worker
  if (req.method === 'PATCH' && urlParts.startsWith('/api/tickets/')) {
    const rawParam = urlParts.replace('/api/tickets/', '');
    const decodedTicketNo = decodeURIComponent(rawParam).trim();
    const cleanTarget = decodedTicketNo.toLowerCase();
    const cleanDigits = cleanTarget.replace(/\D/g, '');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
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

        if (updates.assignedWorker && updates.assignedWorker !== currentTicket.assignedWorker) {
          if (!updates.status) {
            updates.status = 'Ongoing';
          }

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
        res.end(JSON.stringify(data.tickets[idx]));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/send-worker-email -> Admin sends direct email to worker via SMTP with COMPLETED button
  if (req.method === 'POST' && (urlParts === '/api/send-worker-email' || urlParts === '/api/send-email')) {
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
