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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'tickets.json');
const PORT = 5000;

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
          <a href="http://localhost:5175/" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-weight: bold; border-radius: 6px; text-decoration: none;">View in Admin Portal</a>
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

  // 2. Worker Assigned
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

  // 3. Worker Clicked COMPLETED / Solved
  if (t.status === 'Completed' || t.completedAt) {
    events.push({
      id: `evt-${t.ticketNo}-completed`,
      type: 'WORKER_COMPLETED',
      title: `Worker Clicked "COMPLETED"`,
      timestamp: t.completedAt || t.updatedAt || new Date().toISOString(),
      actor: t.completedBy || t.assignedWorker || 'Maintenance Staff',
      details: `Worker confirmed completion of ${t.issueCategory || 'repairs'} on site via 1-click token.`
    });

    events.push({
      id: `evt-${t.ticketNo}-verified`,
      type: 'SOLVED',
      title: 'Task Completed & Closed',
      timestamp: t.completedAt || t.updatedAt || new Date().toISOString(),
      actor: 'Central Facilities System',
      details: `Work record marked COMPLETED in database. Verified at ${t.completedDate || ''} ${t.completedTime || ''}.`
    });
  }

  return events;
}

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    let changed = false;
    if (Array.isArray(data.tickets)) {
      data.tickets.forEach(t => {
        if (!t.completionToken) {
          t.completionToken = generateToken();
          changed = true;
        }
        if (!Array.isArray(t.history) || t.history.length === 0) {
          t.history = buildHistoryForTicket(t);
          changed = true;
        }
      });
    }
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
    { id: 'w1', name: 'Rajan Kumar', role: 'Electrical Lead', email: 'rajan.electrical@mrf.edu', icon: '💡', active: true, phone: '+91 98401 12345' },
    { id: 'w2', name: 'Suresh Menon', role: 'Plumbing Specialist', email: 'suresh.plumbing@mrf.edu', icon: '🚰', active: true, phone: '+91 98402 23456' },
    { id: 'w3', name: 'Priya Nair', role: 'IT & Infrastructure', email: 'priya.it@mrf.edu', icon: '🖥️', active: true, phone: '+91 98403 34567' },
    { id: 'w4', name: 'Anitha Pillai', role: 'Civil Maintenance', email: 'anitha.civil@mrf.edu', icon: '🪟', active: true, phone: '+91 98404 45678' },
    { id: 'w5', name: 'Biju Thomas', role: 'Sanitation Lead', email: 'biju.sanitation@mrf.edu', icon: '🧹', active: true, phone: '+91 98405 56789' },
  ],
  categories: [
    { id: 'cat1', label: '💡 Electrical', prefix: 'Electrical issue: ', active: true, color: 'amber' },
    { id: 'cat2', label: '🚰 Plumbing', prefix: 'Plumbing issue: ', active: true, color: 'cyan' },
    { id: 'cat3', label: '🖥️ IT / Network', prefix: 'IT/Network issue: ', active: true, color: 'indigo' },
    { id: 'cat4', label: '🪟 Civil / Infra', prefix: 'Civil/Infrastructure issue: ', active: true, color: 'orange' },
    { id: 'cat5', label: '🧹 Sanitation', prefix: 'Sanitation issue: ', active: true, color: 'emerald' },
    { id: 'cat6', label: '♿ Accessibility', prefix: 'Accessibility issue: ', active: true, color: 'sky' },
    { id: 'cat7', label: '📌 Others', prefix: 'Other issue: ', active: true, color: 'rose' },
  ],
  announcement: {
    enabled: true,
    message: '⚡ Campus Facilities Notice: Centralized 24/7 maintenance reporting is active across all blocks.',
    type: 'info',
    lastUpdated: new Date().toISOString(),
  },
  slaTargetHours: 24,
  autoEmailAlerts: true,
};

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG_DATA, null, 2));
      return DEFAULT_CONFIG_DATA;
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
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

const server = http.createServer((req, res) => {
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
  if (req.method === 'GET' && urlParts === '/api/system-config') {
    const cfg = readConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cfg));
    return;
  }

  // POST /api/system-config -> updates system config
  if (req.method === 'POST' && urlParts === '/api/system-config') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const newCfg = JSON.parse(body);
        saveConfig(newCfg);
        console.log(`[Config Updated] System configuration updated by Super Admin.`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newCfg));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // DELETE /api/tickets/:ticketNo -> delete ticket for Super Admin
  if (req.method === 'DELETE' && urlParts.startsWith('/api/tickets/')) {
    const ticketNo = decodeURIComponent(urlParts.replace('/api/tickets/', ''));
    const data = readData();
    const idx = data.tickets.findIndex(t => t.ticketNo === ticketNo);
    if (idx === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ticket not found' }));
      return;
    }
    const deleted = data.tickets.splice(idx, 1)[0];
    saveData(data);
    console.log(`[Super Admin Delete] Ticket ${ticketNo} deleted permanently.`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, deleted }));
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

        data.counter += 1;
        const ticketNo = `#${String(data.counter).padStart(3, '0')}`;
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
            }
          ],
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
    const ticketNo = decodeURIComponent(urlParts.replace('/api/tickets/', ''));
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const data = readData();
        const idx = data.tickets.findIndex(t => t.ticketNo === ticketNo);

        if (idx === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Ticket not found' }));
          return;
        }

        const currentTicket = data.tickets[idx];
        if (!Array.isArray(currentTicket.history)) {
          currentTicket.history = buildHistoryForTicket(currentTicket);
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
          completionLink = `http://localhost:5000/api/complete-task?token=${targetTicket.completionToken}`;
        }

        const taskLocation = location || (targetTicket ? `${targetTicket.block || 'Campus'} (Room ${targetTicket.roomNo || 'N/A'})` : 'Campus Facilities');
        const taskCategory = issueCategory || (targetTicket ? targetTicket.issueCategory : 'Maintenance Service');

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

  // GET or POST /api/complete-task or /complete-task -> Worker clicks COMPLETED button in email
  if (urlParts === '/api/complete-task' || urlParts === '/complete-task') {
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
              <a href="http://localhost:5175/" class="btn">Open Admin Portal</a>
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
              <a href="http://localhost:5175/" class="btn">Open Admin Portal</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // If task is ALREADY completed -> show safe informational screen (idempotent, no corruption)
    if (ticket.status === 'Completed') {
      const completedTimeFormatted = ticket.completedAt
        ? new Date(ticket.completedAt).toLocaleString()
        : (ticket.completedDate ? `${ticket.completedDate} ${ticket.completedTime || ''}` : new Date(ticket.updatedAt).toLocaleString());

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Task Already Completed — MCC Campus Facilities</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f0fdf4; color: #1e293b; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
            .card { background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #bbf7d0; overflow: hidden; text-align: center; }
            .header { background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; padding: 26px 20px; }
            .content { padding: 32px 24px; }
            .badge { display: inline-block; background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 800; padding: 5px 14px; border-radius: 20px; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px; }
            .info-table { width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin: 20px 0; font-size: 13px; text-align: left; }
            .info-table td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
            .info-table tr:last-child td { border-bottom: none; }
            .btn { display: inline-block; background: #16a34a; color: #ffffff; padding: 12px 26px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25); }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2 style="margin:0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px;">MCC Campus Facilities</h2>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Official Work Order Tracking</p>
            </div>
            <div class="content">
              <div class="badge">ℹ️ Status Logged</div>
              <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 20px; font-weight: 900;">This task has already been completed.</h3>
              <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.5;">No further action is required. The resolution is already recorded in the central facilities database.</p>
              
              <table class="info-table">
                <tr>
                  <td style="color: #64748b; font-weight: 700; width: 42%;">Work / Task ID:</td>
                  <td style="color: #0f172a; font-weight: 900;">${ticket.ticketNo}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 700;">Worker:</td>
                  <td style="color: #0f172a; font-weight: 700;">${ticket.assignedWorker || ticket.completedBy || 'Staff'}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 700;">Status:</td>
                  <td style="color: #16a34a; font-weight: 900;">✓ COMPLETED</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 700;">Completed At:</td>
                  <td style="color: #334155; font-weight: 600;">${completedTimeFormatted}</td>
                </tr>
              </table>

              <p style="font-size: 11px; color: #94a3b8; margin: 0 0 18px 0;">Admin Portal has been synced in real time.</p>
              <a href="http://localhost:5175/" class="btn">View Admin Portal</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Mark task as COMPLETED in backend
    const nowIso = new Date().toISOString();
    const completedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const completedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (!Array.isArray(ticket.history)) {
      ticket.history = buildHistoryForTicket(ticket);
    }

    ticket.history.push({
      id: `evt-${ticket.ticketNo}-worker-comp-${Date.now()}`,
      type: 'WORKER_COMPLETED',
      title: `Worker Clicked "COMPLETED"`,
      timestamp: nowIso,
      actor: ticket.assignedWorker || 'Maintenance Staff',
      details: `Worker confirmed on-site completion of ${ticket.issueCategory || 'repairs'} using 1-click email token.`
    });

    ticket.history.push({
      id: `evt-${ticket.ticketNo}-solved-${Date.now()}`,
      type: 'SOLVED',
      title: 'Task Completed & Closed',
      timestamp: nowIso,
      actor: 'Central Facilities System',
      details: `Work order marked COMPLETED in database. Verified at ${completedDate} ${completedTime}.`
    });

    ticket.status = 'Completed';
    ticket.completedAt = nowIso;
    ticket.completedDate = completedDate;
    ticket.completedTime = completedTime;
    ticket.updatedAt = nowIso;
    ticket.completedBy = ticket.assignedWorker || 'Maintenance Staff';

    saveData(data);
    console.log(`[Worker Task Completed] Ticket ${ticket.ticketNo} marked as COMPLETED by ${ticket.assignedWorker} at ${nowIso}`);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Task Completed Successfully — MCC Facilities</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f0fdf4; color: #1e293b; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
          .card { background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; box-shadow: 0 12px 36px rgba(16, 185, 129, 0.15); border: 1px solid #bbf7d0; overflow: hidden; text-align: center; }
          .header { background: linear-gradient(135deg, #065f46, #047857); color: #ffffff; padding: 28px 20px; }
          .checkmark { width: 60px; height: 60px; background: #ffffff; border-radius: 50%; color: #059669; font-size: 34px; font-weight: 900; line-height: 60px; margin: 0 auto 12px auto; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
          .content { padding: 32px 24px; }
          .info-table { width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin: 20px 0; font-size: 13px; text-align: left; }
          .info-table td { padding: 11px 14px; border-bottom: 1px solid #e2e8f0; }
          .info-table tr:last-child td { border-bottom: none; }
          .btn { display: inline-block; background: #059669; color: #ffffff; padding: 13px 28px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3); }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="checkmark">✓</div>
            <h2 style="margin:0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px;">Task Completed Successfully</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #d1fae5; font-weight: 600;">Your task has been marked as completed.</p>
          </div>
          <div class="content">
            <p style="color: #334155; font-size: 13px; margin: 0; line-height: 1.5;">Thank you! The central Facilities Administration and live Admin Portal have been updated.</p>
            
            <table class="info-table">
              <tr>
                <td style="color: #64748b; font-weight: 700; width: 42%;">Work / Task ID:</td>
                <td style="color: #0f172a; font-weight: 900; font-size: 14px;">${ticket.ticketNo}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 700;">Worker Name:</td>
                <td style="color: #0f172a; font-weight: 800;">${ticket.assignedWorker}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 700;">Category & Loc:</td>
                <td style="color: #334155; font-weight: 600;">${ticket.issueCategory} · ${ticket.block || 'Campus'}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 700;">Completed Date:</td>
                <td style="color: #059669; font-weight: 800;">${ticket.completedDate}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 700;">Completed Time:</td>
                <td style="color: #059669; font-weight: 800;">${ticket.completedTime}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-weight: 700;">System Status:</td>
                <td style="color: #059669; font-weight: 900;">COMPLETED (100% Synced)</td>
              </tr>
            </table>

            <a href="http://localhost:5175/" class="btn">Open Admin Portal</a>
          </div>
        </div>
      </body>
      </html>
    `);
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

server.listen(PORT, () => {
  console.log(`[MRF Local Sync Server] Running on http://localhost:${PORT}`);
});
