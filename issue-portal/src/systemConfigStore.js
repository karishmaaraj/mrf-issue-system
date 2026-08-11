/**
 * systemConfigStore.js — Dynamic Master Configuration Store for MRF Campus Portal
 * Synced across User Portal, Admin Portal, and Super Admin Command Center.
 */

const CONFIG_KEY = 'mrf_system_config';
const SYNC_URL = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80')
  ? '/api/system-config'
  : 'http://localhost:5000/api/system-config';

export const INITIAL_WORKERS = [
  { id: 'w1', name: 'Rajan Kumar', role: 'Electrical Lead', email: 'rajan.electrical@mrf.edu', icon: '💡', active: true, phone: '+91 98401 12345' },
  { id: 'w2', name: 'Suresh Menon', role: 'Plumbing Specialist', email: 'suresh.plumbing@mrf.edu', icon: '🚰', active: true, phone: '+91 98402 23456' },
  { id: 'w3', name: 'Priya Nair', role: 'IT & Infrastructure', email: 'priya.it@mrf.edu', icon: '🖥️', active: true, phone: '+91 98403 34567' },
  { id: 'w4', name: 'Anitha Pillai', role: 'Civil Maintenance', email: 'anitha.civil@mrf.edu', icon: '🪟', active: true, phone: '+91 98404 45678' },
  { id: 'w5', name: 'Biju Thomas', role: 'Sanitation Lead', email: 'biju.sanitation@mrf.edu', icon: '🧹', active: true, phone: '+91 98405 56789' },
];

export const INITIAL_CATEGORIES = [
  { id: 'cat1', label: '💡 Electrical', prefix: 'Electrical issue: ', active: true, color: 'amber' },
  { id: 'cat2', label: '🚰 Plumbing', prefix: 'Plumbing issue: ', active: true, color: 'cyan' },
  { id: 'cat3', label: '🖥️ IT / Network', prefix: 'IT/Network issue: ', active: true, color: 'indigo' },
  { id: 'cat4', label: '🪟 Civil / Infra', prefix: 'Civil/Infrastructure issue: ', active: true, color: 'orange' },
  { id: 'cat5', label: '🧹 Sanitation', prefix: 'Sanitation issue: ', active: true, color: 'emerald' },
  { id: 'cat6', label: '♿ Accessibility', prefix: 'Accessibility issue: ', active: true, color: 'sky' },
  { id: 'cat7', label: '📌 Others', prefix: 'Other issue: ', active: true, color: 'rose' },
];

export const DEFAULT_CONFIG = {
  workers: INITIAL_WORKERS,
  categories: INITIAL_CATEGORIES,
  announcement: {
    enabled: true,
    message: '⚡ Campus Facilities Notice: Centralized 24/7 maintenance reporting is active across all blocks.',
    type: 'info', // 'info' | 'warning' | 'alert'
    lastUpdated: new Date().toISOString(),
  },
  slaTargetHours: 24,
  autoEmailAlerts: true,
};

/**
 * Loads system configuration from localStorage or returns default
 */
export function getSystemConfig() {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG));
      return DEFAULT_CONFIG;
    }
    return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch (err) {
    console.error('[ConfigStore] Failed to read local config:', err);
    return DEFAULT_CONFIG;
  }
}

/**
 * Saves and broadcasts system configuration
 */
export function saveSystemConfig(newConfig) {
  try {
    const merged = { ...getSystemConfig(), ...newConfig };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
    window.dispatchEvent(new StorageEvent('storage', { key: CONFIG_KEY, newValue: JSON.stringify(merged) }));

    // Async sync to server
    fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    }).catch(() => {});

    return merged;
  } catch (err) {
    console.error('[ConfigStore] Failed to save config:', err);
    return newConfig;
  }
}

/**
 * Fetches latest configuration from server
 */
export async function fetchSystemConfigFromServer() {
  try {
    const res = await fetch(SYNC_URL);
    if (!res.ok) throw new Error('Server error');
    const data = await res.json();
    if (data && typeof data === 'object') {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    // Return local
  }
  return getSystemConfig();
}
