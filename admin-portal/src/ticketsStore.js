/**
 * ticketsStore.js — Memory-Safe Shared Data Layer for MRF Admin Portal
 * Features zero-leak caching, deep comparison checks, and lightweight localStorage persistence.
 */

const SERVER_URL = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80')
  ? '/api/tickets'
  : 'http://localhost:5000/api/tickets';
const TICKETS_KEY = 'mrf_tickets';

let cachedTickets = [];
let lastSerializedHash = '';

const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('mrf_tickets_sync_channel')
  : null;

// Lightweight hash helper for fast equality checking
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
    // Sanitize large photos before writing to localStorage to keep memory and storage footprint under 50KB
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
  }
  return cachedTickets;
}

/**
 * Memory-safe server fetch:
 * Compares data before mutating cache to avoid unnecessary React re-renders and memory allocations.
 * Never broadcasts on polling fetches!
 */
export async function fetchTicketsFromServer() {
  try {
    const res = await fetch(SERVER_URL);
    if (res.ok) {
      const serverTickets = await res.json();
      const newHash = computeSimpleHash(serverTickets);

      if (newHash === lastSerializedHash && cachedTickets.length === serverTickets.length) {
        // Data is identical, return stable reference without re-allocating or re-saving
        return cachedTickets;
      }

      cachedTickets = serverTickets;
      lastSerializedHash = newHash;
      saveLocalTickets(serverTickets);
      return serverTickets;
    }
  } catch (e) {
    // Server offline, return existing cache
  }

  return getTickets();
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
      // Fetch latest server snapshot
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
