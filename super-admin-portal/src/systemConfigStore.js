/**
 * systemConfigStore.js — Central Master Configuration Store for MCC Issue System
 * Unified single source of truth across User Portal, Admin Portal, and Super Admin Command Center.
 * Persists to backend server (http://localhost:5000/api/system-config) with localStorage cache and BroadcastChannel sync.
 */

const CONFIG_KEY = 'mcc_system_config';
const SYNC_URL = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80')
  ? '/api/system-config'
  : 'http://localhost:5000/api/system-config';

export const INITIAL_WORKERS = [
  { id: 'w1', name: 'Rajan Kumar', role: 'Electrical Lead', email: 'karishmaa24raj@gmail.com', icon: '💡', active: true, phone: '+91 98401 12345' },
  { id: 'w2', name: 'Suresh Menon', role: 'Plumbing Specialist', email: 'rajanubama23@gmail.com', icon: '🚰', active: true, phone: '+91 98402 23456' },
  { id: 'w3', name: 'Priya Nair', role: 'IT & Infrastructure', email: 'balap4496@gmail.com', icon: '🖥️', active: true, phone: '+91 98403 34567' },
  { id: 'w4', name: 'Anitha Pillai', role: 'Civil Maintenance', email: 'enaveen508@gmail.com', icon: '🪟', active: true, phone: '+91 98404 45678' },
  { id: 'w5', name: 'Biju Thomas', role: 'Sanitation Lead', email: 'lalitharasi496@gmail.com', icon: '🧹', active: true, phone: '+91 98405 56789' },
];

export const DEFAULT_STARTUP_COMPANIES = [
  'DSRI',
  'Pentagon',
  'Fab Lab',
  'Papados Cafe',
  'Green Era',
  'Anmywill',
  'TMS Media',
  'Five Armstrong',
  'Innoveity',
  'Lexposh'
];

export const INITIAL_CATEGORIES = [
  { id: 'cat1', label: 'Electrical', prefix: 'Electrical issue: ', active: true, color: 'amber' },
  { id: 'cat2', label: 'Plumbing', prefix: 'Plumbing issue: ', active: true, color: 'cyan' },
  { id: 'cat3', label: 'IT / Network', prefix: 'IT/Network issue: ', active: true, color: 'indigo' },
  { id: 'cat4', label: 'Civil / Infra', prefix: 'Civil/Infrastructure issue: ', active: true, color: 'orange' },
  { id: 'cat5', label: 'Sanitation', prefix: 'Sanitation issue: ', active: true, color: 'emerald' },
  { id: 'cat6', label: 'Accessibility', prefix: 'Accessibility issue: ', active: true, color: 'sky' },
  { id: 'cat7', label: 'Others', prefix: 'Other issue: ', active: true, color: 'rose' },
];

export const DEFAULT_SECTIONS = [
  {
    id: 'sec_personal',
    title: 'Personal Information',
    enabled: true,
    fields: [
      { id: 'name', label: 'Full Name', type: 'text', required: true, enabled: true, placeholder: 'Enter your full name' },
      { id: 'email', label: 'Email Address', type: 'email', required: true, enabled: true, placeholder: 'student@mcc.edu.in' },
      { id: 'phone', label: 'Phone Number', type: 'phone', required: false, enabled: true, placeholder: '+91 9876543210' },
    ]
  },
  {
    id: 'sec_role',
    title: 'Role & Classification',
    enabled: true,
    fields: [
      {
        id: 'userType',
        label: 'User Classification',
        type: 'select',
        required: true,
        enabled: true,
        options: ['Student', 'Staff', 'Unit / Office', 'Startup']
      },
      {
        id: 'studentStream',
        label: 'Stream',
        type: 'select',
        required: true,
        enabled: true,
        options: ['Aided', 'SFS (Self-Financing)']
      },
      {
        id: 'studentLevel',
        label: 'Level',
        type: 'select',
        required: true,
        enabled: true,
        options: ['UG (Undergraduate)', 'PG (Postgraduate)']
      },
      {
        id: 'department',
        label: 'Department',
        type: 'select',
        required: true,
        enabled: true,
        options: [
          'Computer Applications (BCA)',
          'Computer Science',
          'Commerce',
          'Economics',
          'Chemistry',
          'Physics',
          'English',
          'Mathematics',
          'Physical Education',
          'Administrative Office',
          'Hostel / Residential',
          'General Campus'
        ]
      },
      {
        id: 'company',
        label: 'Company',
        type: 'select',
        required: true,
        enabled: true,
        options: DEFAULT_STARTUP_COMPANIES
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
        options: ['A', 'B', 'C', 'D', 'Main Building', 'Science Block', 'MCC Innovation Park', 'Hostels']
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
];

export function getNormalizedFormConfig(complaintForm) {
  if (!complaintForm) {
    return { sections: DEFAULT_SECTIONS };
  }

  let sections = complaintForm.sections;
  if (!Array.isArray(sections) || sections.length === 0) {
    const userTypeOpts = complaintForm.fields?.userType?.options || DEFAULT_SECTIONS[1].fields[0].options;
    const deptOpts = complaintForm.fields?.department?.options || DEFAULT_SECTIONS[1].fields[1].options;
    const blockOpts = complaintForm.fields?.location?.blocks || DEFAULT_SECTIONS[2].fields[0].options;

    sections = DEFAULT_SECTIONS.map(sec => {
      const secCopy = { ...sec, fields: sec.fields.map(f => ({ ...f })) };
      if (secCopy.id === 'sec_role') {
        const userTypeField = secCopy.fields.find(f => f.id === 'userType');
        if (userTypeField && Array.isArray(userTypeOpts)) userTypeField.options = userTypeOpts;

        const deptField = secCopy.fields.find(f => f.id === 'department');
        if (deptField && Array.isArray(deptOpts)) deptField.options = deptOpts;
      }
      if (secCopy.id === 'sec_location') {
        const blockField = secCopy.fields.find(f => f.id === 'block');
        if (blockField && Array.isArray(blockOpts)) blockField.options = blockOpts;
      }
      return secCopy;
    });
  }

  return {
    ...complaintForm,
    sections,
  };
}

export const DEFAULT_CONFIG = {
  version: '2.1.0',
  lastPublished: new Date().toISOString(),
  publishedBy: 'Super Admin',
  companies: DEFAULT_STARTUP_COMPANIES,

  // 1. BRANDING
  branding: {
    portalName: 'MCC FIX HUB',
    portalSubtitle: 'Campus Maintenance Tracking System',
    organizationName: 'Madras Christian College',
    shortOrgName: 'MCC',
    logoUrl: '/mcc.png',
    faviconUrl: '/mcc.png',
    officialBadgeText: 'OFFICIAL MCC PORTAL',
  },

  // 2. THEME & VISUAL STYLE
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

  // 3. NAVIGATION
  navigation: {
    headerLinks: [
      { id: 'nav-home', label: 'Home', path: '/', visible: true, icon: 'Home' },
      { id: 'nav-report', label: 'Report Issue', path: '/complaint', visible: true, icon: 'PlusCircle' },
      { id: 'nav-track', label: 'Track Ticket', path: '/#workflow-section', visible: true, icon: 'Search' }
    ]
  },

  // 4. HOME / LANDING PAGE
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
      backgroundImage: '/campus_bg.png',
      desktopBackgroundImage: '/campus_bg.png',
      mobileBackgroundImage: '',
      enableKenBurns: true,
      overlayOpacity: 0.85,
    },
    statistics: {
      visible: true,
      cards: [
        { id: 'stat-resolved', value: '100+', label: 'Issues Resolved', desc: 'Successfully resolved maintenance requests', color: 'emerald', icon: 'CheckCircle2', visible: true },
        { id: 'stat-sla', value: '24h', label: 'Response SLA', desc: 'Average target response time', color: 'amber', icon: 'Clock', visible: true },
        { id: 'stat-depts', value: '14+', label: 'Departments', desc: 'Working together for a better campus', color: 'sky', icon: 'Users', visible: true },
        { id: 'stat-tracked', value: '100%', label: 'Tracked & Logged', desc: 'Every request is tracked transparently', color: 'purple', icon: 'BarChart2', visible: true }
      ]
    },
    workflowSection: {
      visible: true,
      badge: 'TRANSPARENT CAMPUS WORKFLOW',
      heading: 'How Complaints Get Solved',
      subtitle: 'Clear 3-stage process from ticket submission to full resolution.'
    }
  },

  // 4b. FACILITIES CONTACT & EMERGENCY INFORMATION
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

  // 5. COMPLAINT FORM CONTROLS
  complaintForm: {
    sections: DEFAULT_SECTIONS,
    fields: {
      name: { label: 'Full Name', placeholder: 'Enter your full name', required: true, visible: true },
      email: { label: 'Official / Personal Email', placeholder: 'student@mcc.edu.in', required: true, visible: true },
      phone: { label: 'Phone Number', placeholder: '10-digit mobile number', required: true, visible: true },
      userType: { label: 'User Classification', options: ['Student', 'Staff', 'Unit / Office', 'Startup'], required: true, visible: true },
      department: {
        label: 'Department / Stream',
        options: [
          'Computer Applications (BCA)',
          'Computer Science',
          'Commerce',
          'Economics',
          'Chemistry',
          'Physics',
          'English',
          'Mathematics',
          'Physical Education',
          'Administrative Office',
          'Hostel / Residential',
          'General Campus'
        ],
        required: true,
        visible: true
      },
      location: {
        label: 'Campus Block & Room',
        blocks: ['A', 'B', 'C', 'D', 'Main Building', 'Science Block', 'MCC Innovation Park', 'Hostels'],
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

  // 6. USER PORTAL AVAILABILITY
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

  // 7. ADMIN PORTAL SETTINGS
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

  // 8. WORKERS ROSTER
  workers: INITIAL_WORKERS,

  // 9. ISSUE CATEGORIES
  categories: INITIAL_CATEGORIES,

  // 10. ANNOUNCEMENTS / BROADCAST ALERTS
  announcement: {
    enabled: true,
    message: '⚡ Campus Facilities Notice: Centralized 24/7 maintenance reporting is active across all blocks.',
    type: 'info', // 'info' | 'warning' | 'alert'
    lastUpdated: new Date().toISOString(),
  },

  // 11. EMAIL NOTIFICATION TEMPLATES (No SMTP credentials exposed!)
  emailTemplates: {
    adminNotificationSubject: '[MCC Ticket {{ticketNo}}] {{isUrgentTag}}{{issueCategory}} - {{name}}',
    workerDispatchSubject: 'Work Order Dispatched: {{ticketNo}} [{{issueCategory}}]',
    resolutionSubject: 'Resolved: Your Ticket {{ticketNo}} has been Solved',
    footerText: 'MCC Issue Resolution System • Automated Campus Notification'
  },

  // 12. FEATURE SWITCHBOARD
  features: {
    allowPhotoUpload: true,
    allowLiveTimeline: true,
    allowWorkerSelfComplete: true,
    enableSmtpDispatch: true,
    enableAnnouncements: true,
    enableHeroKenBurns: true
  },

  // Legacy compatibility keys
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
};

/**
 * Deep merge utility to ensure backwards compatibility with older config versions
 */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
  const output = Array.isArray(target) ? [...target] : { ...target };

  for (const key of Object.keys(source)) {
    const sVal = source[key];
    const tVal = target[key];

    if (sVal === null || sVal === undefined) {
      if (key in target) continue;
    }

    if (Array.isArray(tVal)) {
      if (Array.isArray(sVal) && sVal.length > 0) {
        output[key] = sVal;
      }
    } else if (tVal && typeof tVal === 'object') {
      if (sVal && typeof sVal === 'object' && !Array.isArray(sVal)) {
        output[key] = deepMerge(tVal, sVal);
      }
    } else {
      if (sVal !== undefined) {
        output[key] = sVal;
      }
    }
  }
  return output;
}

function hexToRgb(hex) {
  if (!hex) return '220, 38, 38';
  let c = String(hex).replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return '220, 38, 38';
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

/**
 * Applies dynamic CSS theme custom properties to :root
 */
export function applyThemeTokens(theme) {
  if (typeof document === 'undefined' || !theme) return;
  const root = document.documentElement;
  const primary = theme.primaryColor || '#DC2626';
  const hover = theme.primaryHoverColor || theme.primaryColor || '#B91C1C';
  const accent = theme.accentColor || primary;

  root.style.setProperty('--primary-color', primary);
  root.style.setProperty('--primary-hover', hover);
  root.style.setProperty('--accent-color', accent);
  root.style.setProperty('--primary-color-rgb', hexToRgb(primary));

  if (theme.borderRadius) {
    root.style.setProperty('--theme-radius', theme.borderRadius);
  }
}

/**
 * Loads system configuration from localStorage or returns default
 */
export function getSystemConfig() {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG));
      applyThemeTokens(DEFAULT_CONFIG.theme);
      return DEFAULT_CONFIG;
    }
    const parsed = JSON.parse(stored);
    
    // Ensure stale cached company values do not override the new server configuration
    if (parsed.version !== DEFAULT_CONFIG.version) {
      parsed.companies = DEFAULT_STARTUP_COMPANIES;
      if (parsed.complaintForm?.sections) {
        parsed.complaintForm.sections.forEach(sec => {
          if (sec.fields) {
            sec.fields.forEach(f => {
              if (f.id === 'company') f.options = DEFAULT_STARTUP_COMPANIES;
            });
          }
        });
      }
      if (parsed.complaintForm?.fields?.company) {
        parsed.complaintForm.fields.company.options = DEFAULT_STARTUP_COMPANIES;
      }
      parsed.version = DEFAULT_CONFIG.version;
      localStorage.setItem(CONFIG_KEY, JSON.stringify(parsed));
    }

    const config = deepMerge(DEFAULT_CONFIG, parsed);
    applyThemeTokens(config.theme);
    return config;
  } catch (err) {
    console.error('[ConfigStore] Failed to read local config:', err);
    applyThemeTokens(DEFAULT_CONFIG.theme);
    return DEFAULT_CONFIG;
  }
}

const configSyncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('mcc_config_sync_channel')
  : null;

if (configSyncChannel) {
  configSyncChannel.onmessage = (e) => {
    if (e.data && e.data.type === 'CONFIG_UPDATED' && e.data.config) {
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(e.data.config));
        applyThemeTokens(e.data.config.theme);
        window.dispatchEvent(new StorageEvent('storage', { key: CONFIG_KEY, newValue: JSON.stringify(e.data.config) }));
      } catch { }
    }
  };
}

/**
 * Saves and broadcasts system configuration
 */
export async function saveSystemConfig(newConfig) {
  try {
    const current = getSystemConfig();
    const merged = deepMerge(current, newConfig);
    merged.lastPublished = new Date().toISOString();

    // Sync legacy top-level keys if nested objects changed
    if (merged.userPortal) {
      if (merged.userPortal.portalActive !== undefined) merged.portalActive = merged.userPortal.portalActive;
      if (merged.userPortal.submissionsEnabled !== undefined) merged.submissionsEnabled = merged.userPortal.submissionsEnabled;
      if (merged.userPortal.portalNotice !== undefined) merged.portalNotice = merged.userPortal.portalNotice;
    }
    if (merged.announcements && !merged.announcement) {
      merged.announcement = merged.announcements;
    }

    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
    window.dispatchEvent(new StorageEvent('storage', { key: CONFIG_KEY, newValue: JSON.stringify(merged) }));

    if (configSyncChannel) {
      configSyncChannel.postMessage({ type: 'CONFIG_UPDATED', config: merged });
    }

    // Await server sync
    try {
      const res = await fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(merged),
      });
      if (res.ok) {
        const saved = await res.json();
        if (saved && typeof saved === 'object') {
          const finalMerged = deepMerge(DEFAULT_CONFIG, saved);
          localStorage.setItem(CONFIG_KEY, JSON.stringify(finalMerged));
          if (configSyncChannel) {
            configSyncChannel.postMessage({ type: 'CONFIG_UPDATED', config: finalMerged });
          }
          return finalMerged;
        }
      }
    } catch (e) {
      console.warn('[ConfigStore] Server sync offline, saved to localStorage cache.', e);
    }

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
      const merged = deepMerge(DEFAULT_CONFIG, data);
      localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
      applyThemeTokens(merged.theme);
      return merged;
    }
  } catch (err) {
    // Return local fallback
  }
  return getSystemConfig();
}
