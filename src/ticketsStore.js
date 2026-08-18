/**
 * ticketsStore.js — Memory-Safe Shared Data Layer with Local Sync Server Integration
 * Connects to http://localhost:5000/api/tickets with BroadcastChannel and localStorage fallback.
 * Keeps Student Portal, Admin Portal, and Super Admin Portal 100% synchronized in real time!
 */

export function getApiBase() {
  if (typeof window === 'undefined') return 'http://localhost:5000';
  if (window.location.port === '' || window.location.port === '80') {
    return '';
  }
  const hostname = window.location.hostname || 'localhost';
  return `http://${hostname}:5000`;
}

export function getTicketsApiUrl() {
  return `${getApiBase()}/api/tickets`;
}

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
        syncLocalCounterWithTickets(e.data.tickets);
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

export function extractMaxTicketNumber(tickets = []) {
  if (!Array.isArray(tickets)) return 0;
  return tickets.reduce((max, t) => {
    if (!t || !t.ticketNo) return max;
    const match = String(t.ticketNo).match(/\d+/);
    const num = match ? parseInt(match[0], 10) : 0;
    return Math.max(max, isNaN(num) ? 0 : num);
  }, 0);
}

export function syncLocalCounterWithTickets(tickets = []) {
  if (typeof window === 'undefined') return;
  try {
    const localCounter = parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10);
    const maxExisting = extractMaxTicketNumber(tickets);
    const updated = Math.max(localCounter, maxExisting);
    localStorage.setItem(COUNTER_KEY, String(updated));
  } catch {
    // Ignore storage issues
  }
}

export function getNextTicketNumber(tickets = []) {
  const localCounter = typeof window !== 'undefined' ? parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10) : 0;
  const maxExisting = extractMaxTicketNumber(tickets);
  const nextNum = Math.max(localCounter, maxExisting) + 1;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(COUNTER_KEY, String(nextNum));
    } catch {
      // Ignore
    }
  }
  return `#${String(nextNum).padStart(3, '0')}`;
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

export function getTickets() {
  if (cachedTickets.length > 0) return cachedTickets;
  const local = getLocalTickets();
  if (local.length > 0) {
    cachedTickets = local;
    lastSerializedHash = computeSimpleHash(local);
    syncLocalCounterWithTickets(local);
  }
  return cachedTickets;
}

export async function fetchTicketsFromServer() {
  const serverUrl = getTicketsApiUrl();
  try {
    const res = await fetch(serverUrl);
    if (res.ok) {
      const serverTickets = await res.json();
      const newHash = computeSimpleHash(serverTickets);

      if (newHash === lastSerializedHash && cachedTickets.length === serverTickets.length) {
        syncLocalCounterWithTickets(serverTickets);
        return cachedTickets;
      }

      cachedTickets = serverTickets;
      lastSerializedHash = newHash;
      saveLocalTickets(serverTickets);
      syncLocalCounterWithTickets(serverTickets);
      return serverTickets;
    }
  } catch (e) {
    // Fallback to local
  }

  const local = getTickets();
  syncLocalCounterWithTickets(local);
  return local;
}

export async function createTicket(formData) {
  const serverUrl = getTicketsApiUrl();
  try {
    const res = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      const newTicket = await res.json();
      const freshRes = await fetch(serverUrl);
      if (freshRes.ok) {
        const fresh = await freshRes.json();
        cachedTickets = fresh;
        lastSerializedHash = computeSimpleHash(fresh);
        saveLocalTickets(fresh);
        syncLocalCounterWithTickets(fresh);
        broadcastTicketsUpdate(fresh);
      }
      return newTicket;
    }
  } catch (e) {
    console.warn('Sync server offline, creating ticket locally...', e);
  }

  const localTickets = getLocalTickets();
  const ticketNo = getNextTicketNumber(localTickets);
  const now = new Date().toISOString();
  const newTicket = {
    ticketNo,
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
  syncLocalCounterWithTickets(localTickets);
  broadcastTicketsUpdate(localTickets);
  return newTicket;
}

export async function updateTicket(ticketNo, updates) {
  const serverUrl = getTicketsApiUrl();
  try {
    const res = await fetch(`${serverUrl}/${encodeURIComponent(ticketNo)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (res.ok) {
      const updated = await res.json();
      const freshRes = await fetch(serverUrl);
      if (freshRes.ok) {
        const fresh = await freshRes.json();
        cachedTickets = fresh;
        lastSerializedHash = computeSimpleHash(fresh);
        saveLocalTickets(fresh);
        syncLocalCounterWithTickets(fresh);
        broadcastTicketsUpdate(fresh);
      }
      return updated;
    }
  } catch (e) {
    console.warn('Sync server offline, updating ticket locally...', e);
  }

  const localTickets = getLocalTickets();
  const cleanTarget = String(ticketNo).trim().toLowerCase();
  const cleanDigits = cleanTarget.replace(/\D/g, '');
  const idx = localTickets.findIndex(t => {
    const tNo = (t.ticketNo || '').trim().toLowerCase();
    const tDigits = tNo.replace(/\D/g, '');
    return tNo === cleanTarget || (cleanDigits && tDigits === cleanDigits);
  });
  if (idx === -1) return null;

  localTickets[idx] = {
    ...localTickets[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  cachedTickets = localTickets;
  lastSerializedHash = computeSimpleHash(localTickets);
  saveLocalTickets(localTickets);
  syncLocalCounterWithTickets(localTickets);
  broadcastTicketsUpdate(localTickets);
  return localTickets[idx];
}

export async function deleteTicket(ticketNo) {
  const serverUrl = getTicketsApiUrl();
  let serverSuccess = false;
  let serverError = null;

  try {
    const res = await fetch(`${serverUrl}/${encodeURIComponent(ticketNo)}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      serverSuccess = true;
      const freshRes = await fetch(serverUrl);
      if (freshRes.ok) {
        const fresh = await freshRes.json();
        cachedTickets = fresh;
        lastSerializedHash = computeSimpleHash(fresh);
        saveLocalTickets(fresh);
        syncLocalCounterWithTickets(fresh);
        broadcastTicketsUpdate(fresh);
        return { success: true, tickets: fresh };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      serverError = new Error(errData.error || `Server responded with status ${res.status}`);
    }
  } catch (e) {
    serverError = e;
    console.warn('[ticketsStore] Sync server delete error:', e.message);
  }

  if (serverError && !serverSuccess) {
    throw serverError;
  }

  const cleanTarget = String(ticketNo).trim().toLowerCase();
  const cleanDigits = cleanTarget.replace(/\D/g, '');
  const localTickets = getLocalTickets();
  const filtered = localTickets.filter(t => {
    const tNo = (t.ticketNo || '').trim().toLowerCase();
    const tDigits = tNo.replace(/\D/g, '');
    return !(tNo === cleanTarget || (cleanDigits && tDigits === cleanDigits));
  });

  cachedTickets = filtered;
  lastSerializedHash = computeSimpleHash(filtered);
  saveLocalTickets(filtered);
  syncLocalCounterWithTickets(filtered);
  broadcastTicketsUpdate(filtered);
  return { success: true, tickets: filtered };
}

export function isTicketUrgent(ticket) {
  if (ticket.isUrgent) return true;
  if (ticket.status === 'Completed') return false;
  const ageHours = (Date.now() - new Date(ticket.createdAt).getTime()) / 36e5;
  return ageHours > 48;
}

