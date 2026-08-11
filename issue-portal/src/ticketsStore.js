/**
 * ticketsStore.js — Memory-Safe Shared Data Layer with Local Sync Server Integration
 * Connects to http://localhost:5000/api/tickets with BroadcastChannel and localStorage fallback.
 * Keeps Student Portal (port 5174) and Admin Portal (port 5175) 100% synchronized in real time!
 */

const SERVER_URL = 'http://localhost:5000/api/tickets';
const TICKETS_KEY = 'mrf_tickets';
const COUNTER_KEY = 'mrf_ticket_counter';

let cachedTickets = [];
let lastSerializedHash = '';

const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('mrf_tickets_sync_channel')
  : null;

function computeSimpleHash(tickets) {
  if (!Array.isArray(tickets)) return '';
  return tickets.map(t => `${t.ticketNo}-${t.status}-${t.assignedWorker || ''}-${t.updatedAt || t.createdAt || ''}`).join('|');
}

if (syncChannel) {
  syncChannel.onmessage = (e) => {
    if (e.data && e.data.type === 'TICKETS_UPDATED' && Array.isArray(e.data.tickets)) {
      const newHash = computeSimpleHash(e.data.tickets);
      if (newHash !== lastSerializedHash) {
        cachedTickets = e.data.tickets;
        lastSerializedHash = newHash;
        saveLocalTickets(e.data.tickets);
      }
    }
  };
}

function broadcastTicketsUpdate(tickets) {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type: 'TICKETS_UPDATED', tickets });
    } catch (e) {
      console.warn('[BroadcastChannel Error]', e);
    }
  }
}

export function getLocalTickets() {
  try {
    const raw = localStorage.getItem(TICKETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTickets(tickets) {
  try {
    const lightweight = tickets.map(t => {
      if (t.photo && t.photo.length > 50000) {
        return { ...t, photo: null };
      }
      return t;
    });
    localStorage.setItem(TICKETS_KEY, JSON.stringify(lightweight));
  } catch (e) {
    console.warn('[LocalStorage Save Error]', e);
  }
}

function nextTicketNoLocal() {
  const current = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(COUNTER_KEY, String(current));
  return `#${String(current).padStart(3, '0')}`;
}

export function getTickets() {
  if (cachedTickets.length > 0) return cachedTickets;
  const local = getLocalTickets();
  if (local.length > 0) {
    cachedTickets = local;
    lastSerializedHash = computeSimpleHash(local);
  }
  return cachedTickets;
}

export async function fetchTicketsFromServer() {
  try {
    const res = await fetch(SERVER_URL);
    if (res.ok) {
      const serverTickets = await res.json();
      const newHash = computeSimpleHash(serverTickets);

      if (newHash === lastSerializedHash && cachedTickets.length === serverTickets.length) {
        return cachedTickets;
      }

      cachedTickets = serverTickets;
      lastSerializedHash = newHash;
      saveLocalTickets(serverTickets);
      return serverTickets;
    }
  } catch (e) {
    // Fallback to local
  }

  return getTickets();
}

export async function createTicket(formData) {
  try {
    const res = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      const newTicket = await res.json();
      const freshRes = await fetch(SERVER_URL);
      if (freshRes.ok) {
        const fresh = await freshRes.json();
        cachedTickets = fresh;
        lastSerializedHash = computeSimpleHash(fresh);
        saveLocalTickets(fresh);
        broadcastTicketsUpdate(fresh);
      }
      return newTicket;
    }
  } catch (e) {
    console.warn('Sync server offline, creating ticket locally...');
  }

  const localTickets = getLocalTickets();
  const now = new Date().toISOString();
  const newTicket = {
    ticketNo: nextTicketNoLocal(),
    name: formData.name?.trim() || '',
    email: formData.email?.trim() || '',
    phone: formData.phone?.trim() || '',
    department: formData.department || '',
    userType: formData.userType || 'Student',
    studentStream: formData.studentStream || null,
    studentLevel: formData.studentLevel || null,
    block: formData.block || '',
    roomNo: formData.roomNo || '',
    issueCategory: formData.issueCategory || '',
    description: formData.description?.trim() || '',
    priority: formData.priority || 'Normal',
    photo: formData.photo || null,
    status: 'Unsolved',
    isUrgent: formData.priority === 'Critical',
    assignedWorker: null,
    createdAt: now,
    updatedAt: now,
  };

  localTickets.push(newTicket);
  cachedTickets = localTickets;
  lastSerializedHash = computeSimpleHash(localTickets);
  saveLocalTickets(localTickets);
  broadcastTicketsUpdate(localTickets);
  return newTicket;
}

export async function updateTicket(ticketNo, updates) {
  try {
    const res = await fetch(`${SERVER_URL}/${encodeURIComponent(ticketNo)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (res.ok) {
      const updated = await res.json();
      const freshRes = await fetch(SERVER_URL);
      if (freshRes.ok) {
        const fresh = await freshRes.json();
        cachedTickets = fresh;
        lastSerializedHash = computeSimpleHash(fresh);
        saveLocalTickets(fresh);
        broadcastTicketsUpdate(fresh);
      }
      return updated;
    }
  } catch (e) {
    console.warn('Sync server offline, updating ticket locally...');
  }

  const localTickets = getLocalTickets();
  const idx = localTickets.findIndex(t => t.ticketNo === ticketNo);
  if (idx === -1) return null;

  localTickets[idx] = {
    ...localTickets[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  cachedTickets = localTickets;
  lastSerializedHash = computeSimpleHash(localTickets);
  saveLocalTickets(localTickets);
  broadcastTicketsUpdate(localTickets);
  return localTickets[idx];
}

export function isTicketUrgent(ticket) {
  if (ticket.isUrgent) return true;
  if (ticket.status === 'Completed') return false;
  const ageHours = (Date.now() - new Date(ticket.createdAt).getTime()) / 36e5;
  return ageHours > 48;
}
