/**
 * SuperAdminDashboard.jsx — Master Central Governance & Configuration Command Center
 * Controls System Themes, Branding, User Portal, Admin Portal, Staff Roster, Categories, Alerts & Ticket Overrides.
 * Real-time Draft Engine with Live Preview and 1-Click Live Publish across all portals.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Crown, Users, Layers, Megaphone, Wrench, Shield, CheckCircle2, Clock,
  AlertTriangle, Flame, RefreshCw, Trash2, Plus, LogOut, ArrowUpRight,
  Database, BarChart3, Search, ChevronRight, ExternalLink, X, Save,
  Palette, Monitor, Layout, Sliders, Mail, Settings, Globe,
  Check, Undo, Eye, Smartphone, Laptop, RotateCcw, Sparkles
} from 'lucide-react';
import {
  getSystemConfig,
  saveSystemConfig,
  fetchSystemConfigFromServer,
  DEFAULT_CONFIG,
  applyThemeTokens
} from '../systemConfigStore.js';
import {
  getTickets,
  fetchTicketsFromServer,
  updateTicket,
  deleteTicket
} from '../ticketsStore.js';
import CollegeLogo from './CollegeLogo.jsx';
import SuperAdminLogin from './SuperAdminLogin.jsx';

const SUPER_ADMIN_AUTH_KEY = 'mrf_super_admin_authed';

export const PRESET_NAMED_COLORS = [
  { name: 'Red', hex: '#DC2626', hover: '#B91C1C', bg: 'bg-red-600', emoji: '🔴' },
  { name: 'Blue', hex: '#2563EB', hover: '#1D4ED8', bg: 'bg-blue-600', emoji: '🔵' },
  { name: 'Yellow', hex: '#EAB308', hover: '#CA8A04', bg: 'bg-yellow-500', emoji: '🟡' },
  { name: 'Green', hex: '#059669', hover: '#047857', bg: 'bg-emerald-600', emoji: '🟢' },
  { name: 'Purple', hex: '#7C3AED', hover: '#6D28D9', bg: 'bg-purple-600', emoji: '🟣' },
  { name: 'Indigo', hex: '#4F46E5', hover: '#4338CA', bg: 'bg-indigo-600', emoji: '🔷' },
  { name: 'Orange', hex: '#EA580C', hover: '#C2410C', bg: 'bg-orange-600', emoji: '🟠' },
  { name: 'Teal', hex: '#0D9488', hover: '#0F766E', bg: 'bg-teal-600', emoji: '🩵' },
  { name: 'Pink', hex: '#DB2777', hover: '#BE185D', bg: 'bg-pink-600', emoji: '🌸' },
  { name: 'Slate', hex: '#334155', hover: '#1E293B', bg: 'bg-slate-700', emoji: '⚫' },
];

export function getFriendlyColorName(hex) {
  if (!hex) return 'Red';
  const cleanHex = hex.trim().toLowerCase();
  const match = PRESET_NAMED_COLORS.find(c => c.hex.toLowerCase() === cleanHex);
  if (match) return `${match.emoji} ${match.name}`;
  if (cleanHex === '#b91c1c') return '🔴 Dark Red';
  if (cleanHex === '#1d4ed8') return '🔵 Cobalt Blue';
  if (cleanHex === '#0284c7') return '🔵 Sky Blue';
  if (cleanHex === '#d97706') return '🟡 Amber Gold';
  return hex;
}

const COLOR_PRESETS = [
  { id: 'crimson', name: 'MCC Classic Crimson', primary: '#DC2626', hover: '#B91C1C', accent: '#2563EB', bg: '#020617' },
  { id: 'indigo', name: 'Cyber Indigo & Violet', primary: '#4F46E5', hover: '#4338CA', accent: '#7C3AED', bg: '#090D16' },
  { id: 'emerald', name: 'Emerald Forest', primary: '#059669', hover: '#047857', accent: '#0D9488', bg: '#021A15' },
  { id: 'sapphire', name: 'Royal Sapphire Blue', primary: '#2563EB', hover: '#1D4ED8', accent: '#0284C7', bg: '#050E1E' },
  { id: 'amber', name: 'Amber Industrial', primary: '#D97706', hover: '#B45309', accent: '#EA580C', bg: '#170E04' },
  { id: 'amethyst', name: 'Amethyst Purple', primary: '#7C3AED', hover: '#6D28D9', accent: '#DB2777', bg: '#12071F' },
  { id: 'slate', name: 'Slate Minimal', primary: '#334155', hover: '#1E293B', accent: '#64748B', bg: '#0F172A' },
];

export default function SuperAdminDashboard() {
  const [authed, setAuthed] = useState(() => {
    try {
      return sessionStorage.getItem(SUPER_ADMIN_AUTH_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleLogin = () => {
    try {
      sessionStorage.setItem(SUPER_ADMIN_AUTH_KEY, 'true');
    } catch {}
    setAuthed(true);
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(SUPER_ADMIN_AUTH_KEY);
      localStorage.removeItem(SUPER_ADMIN_AUTH_KEY);
    } catch {}
    setAuthed(false);
  };

  const [config, setConfig] = useState(() => getSystemConfig());
  const [draftConfig, setDraftConfig] = useState(() => getSystemConfig());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('desktop'); // 'desktop' | 'mobile'

  const [activeTab, setActiveTab] = useState('overview');
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');
  const [toast, setToast] = useState(null);

  // Modals
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [workerForm, setWorkerForm] = useState({ name: '', role: '', email: '', phone: '', icon: '🔧' });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ label: '', prefix: '', color: 'amber' });
  const [newDepartment, setNewDepartment] = useState('');
  const [newBlock, setNewBlock] = useState('');
  const [newProblemInput, setNewProblemInput] = useState('');
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const [themeHistory, setThemeHistory] = useState([]);

  // Helper to update draft
  const updateDraft = (updater) => {
    setDraftConfig(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      setHasUnsavedChanges(true);
      return next;
    });
  };

  // Helper to apply a theme color and record undo history
  const applyThemeColorWithHistory = (type, newHex, newHover) => {
    const currentPrimary = draftConfig.theme?.primaryColor || '#DC2626';
    const currentAccent = draftConfig.theme?.accentColor || '#2563EB';
    const currentHover = draftConfig.theme?.primaryHoverColor || '#B91C1C';
    const currentHeroHighlight = draftConfig.homePage?.hero?.highlightColor || currentPrimary;

    setThemeHistory(prev => [
      ...prev,
      {
        primaryColor: currentPrimary,
        primaryHoverColor: currentHover,
        accentColor: currentAccent,
        heroHighlight: currentHeroHighlight,
      }
    ]);

    if (type === 'primary') {
      updateDraft(prev => ({
        ...prev,
        theme: {
          ...prev.theme,
          primaryColor: newHex,
          primaryHoverColor: newHover || newHex,
        },
        homePage: {
          ...prev.homePage,
          hero: { ...prev.homePage?.hero, highlightColor: newHex }
        }
      }));
    } else if (type === 'accent') {
      updateDraft(prev => ({
        ...prev,
        theme: {
          ...prev.theme,
          accentColor: newHex,
        }
      }));
    }
  };

  // Undo the last theme color change
  const handleUndoThemeColor = () => {
    if (themeHistory.length === 0) return;
    const lastItem = themeHistory[themeHistory.length - 1];
    setThemeHistory(prev => prev.slice(0, prev.length - 1));

    updateDraft(prev => ({
      ...prev,
      theme: {
        ...prev.theme,
        primaryColor: lastItem.primaryColor,
        primaryHoverColor: lastItem.primaryHoverColor,
        accentColor: lastItem.accentColor,
      },
      homePage: {
        ...prev.homePage,
        hero: { ...prev.homePage?.hero, highlightColor: lastItem.heroHighlight || lastItem.primaryColor }
      }
    }));
    showToastMsg('↩️ Reverted to previous theme color!');
  };

  // Publish to Server and Broadcast Live
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const published = await saveSystemConfig(draftConfig);
      setConfig(published);
      setDraftConfig(published);
      setHasUnsavedChanges(false);
      applyThemeTokens(published.theme);
      showToastMsg('✨ All changes published live across User & Admin portals!');
    } catch (err) {
      showToastMsg('❌ Failed to publish configuration.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Discard Draft Changes
  const handleDiscardDraft = () => {
    setDraftConfig(config);
    setHasUnsavedChanges(false);
    showToastMsg('Draft changes discarded. Restored live configuration.');
  };

  // Initial load and polling
  useEffect(() => {
    fetchSystemConfigFromServer().then(cfg => {
      if (cfg) {
        setConfig(cfg);
        setDraftConfig(cfg);
        applyThemeTokens(cfg.theme);
      }
    });

    fetchTickets();
    const timer = setInterval(() => {
      fetchTickets();
    }, 3500);

    const ticketChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
      ? new BroadcastChannel('mrf_tickets_sync_channel')
      : null;

    if (ticketChannel) {
      ticketChannel.onmessage = (e) => {
        if (e.data && e.data.type === 'TICKETS_UPDATED' && Array.isArray(e.data.tickets)) {
          setTickets(e.data.tickets);
        }
      };
    }

    return () => {
      clearInterval(timer);
      if (ticketChannel) ticketChannel.close();
    };
  }, []);

  const fetchTickets = async () => {
    try {
      const data = await fetchTicketsFromServer();
      if (Array.isArray(data)) {
        setTickets(data);
      }
    } catch (err) {
      setTickets(getTickets());
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const total = tickets.length;
    const unsolved = tickets.filter(t => t.status === 'Unsolved').length;
    const ongoing = tickets.filter(t => t.status === 'Ongoing').length;
    const completed = tickets.filter(t => t.status === 'Completed').length;
    const critical = tickets.filter(t => t.priority === 'Critical').length;
    const activeStaff = (draftConfig.workers || []).filter(w => w.active).length;

    const streamCounts = {
      'Aided (UG/PG)': tickets.filter(t => t.studentStream === 'Aided').length,
      'SFS (UG)': tickets.filter(t => t.studentStream === 'SFS-1' || t.studentStream === 'SFS-2' || (t.userType === 'Student' && t.studentLevel === 'UG' && t.studentStream !== 'Aided')).length,
      'SFS (PG)': tickets.filter(t => t.studentStream === 'SFS-PG' || (t.userType === 'Student' && t.studentLevel === 'PG' && t.studentStream !== 'Aided')).length,
      'Faculty / Staff': tickets.filter(t => t.userType === 'Staff').length,
      'Campus Units / Hostels': tickets.filter(t => t.userType === 'Unit').length,
    };

    return { total, unsolved, ongoing, completed, critical, activeStaff, streamCounts };
  }, [tickets, draftConfig.workers]);

  // Worker operations
  const handleToggleWorker = (workerId) => {
    updateDraft(prev => {
      const workers = (prev.workers || []).map(w => w.id === workerId ? { ...w, active: !w.active } : w);
      return { ...prev, workers };
    });
  };

  const handleDeleteWorker = (workerId, name) => {
    if (!window.confirm(`Remove worker "${name}" from roster?`)) return;
    updateDraft(prev => {
      const workers = (prev.workers || []).filter(w => w.id !== workerId);
      return { ...prev, workers };
    });
  };

  const handleAddWorker = (e) => {
    e.preventDefault();
    if (!workerForm.name || !workerForm.role) return;
    const newWorker = {
      id: `w-${Date.now()}`,
      name: workerForm.name.trim(),
      role: workerForm.role.trim(),
      email: workerForm.email.trim(),
      phone: workerForm.phone.trim(),
      icon: workerForm.icon || '🔧',
      active: true,
    };
    updateDraft(prev => ({
      ...prev,
      workers: [...(prev.workers || []), newWorker]
    }));
    setWorkerForm({ name: '', role: '', email: '', phone: '', icon: '🔧' });
    setShowWorkerModal(false);
  };

  // Category operations
  const handleToggleCategory = (catId) => {
    updateDraft(prev => {
      const categories = (prev.categories || []).map(c => c.id === catId ? { ...c, active: !c.active } : c);
      return { ...prev, categories };
    });
  };

  const handleDeleteCategory = (catId, label) => {
    if (!window.confirm(`Delete category "${label}"?`)) return;
    updateDraft(prev => {
      const categories = (prev.categories || []).filter(c => c.id !== catId);
      return { ...prev, categories };
    });
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!categoryForm.label) return;
    const newCat = {
      id: `cat-${Date.now()}`,
      label: categoryForm.label.trim(),
      prefix: categoryForm.prefix.trim() || `${categoryForm.label.trim().replace(/^[^\w\s]+/, '').trim()} issue: `,
      color: categoryForm.color || 'blue',
      active: true,
    };
    updateDraft(prev => ({
      ...prev,
      categories: [...(prev.categories || DEFAULT_CONFIG.categories || []), newCat]
    }));
    setCategoryForm({ label: '', prefix: '', color: 'amber' });
    setShowCategoryModal(false);
    showToastMsg(`Added problem feature: "${newCat.label}"`);
  };

  const handleAddProblemInline = (e) => {
    e.preventDefault();
    if (!newProblemInput.trim()) return;
    const label = newProblemInput.trim();
    const newCat = {
      id: `cat-${Date.now()}`,
      label: label,
      prefix: `${label.replace(/^[^\w\s]+/, '').trim()} issue: `,
      color: 'blue',
      active: true,
    };
    updateDraft(prev => ({
      ...prev,
      categories: [...(prev.categories || DEFAULT_CONFIG.categories || []), newCat]
    }));
    setNewProblemInput('');
    showToastMsg(`✨ Added problem feature: "${label}"`);
  };

  // Department & Block managers
  const handleAddDepartment = (e) => {
    e.preventDefault();
    if (!newDepartment.trim()) return;
    const current = draftConfig.complaintForm?.fields?.department?.options || DEFAULT_CONFIG.complaintForm.fields.department.options;
    if (current.includes(newDepartment.trim())) return;
    updateDraft(prev => ({
      ...prev,
      complaintForm: {
        ...prev.complaintForm,
        fields: {
          ...prev.complaintForm?.fields,
          department: {
            ...prev.complaintForm?.fields?.department,
            options: [...current, newDepartment.trim()]
          }
        }
      }
    }));
    setNewDepartment('');
  };

  const handleRemoveDepartment = (dept) => {
    const current = draftConfig.complaintForm?.fields?.department?.options || DEFAULT_CONFIG.complaintForm.fields.department.options;
    updateDraft(prev => ({
      ...prev,
      complaintForm: {
        ...prev.complaintForm,
        fields: {
          ...prev.complaintForm?.fields,
          department: {
            ...prev.complaintForm?.fields?.department,
            options: current.filter(d => d !== dept)
          }
        }
      }
    }));
  };

  const handleAddBlock = (e) => {
    e.preventDefault();
    if (!newBlock.trim()) return;
    const current = draftConfig.complaintForm?.fields?.location?.blocks || DEFAULT_CONFIG.complaintForm.fields.location.blocks;
    if (current.includes(newBlock.trim())) return;
    updateDraft(prev => ({
      ...prev,
      complaintForm: {
        ...prev.complaintForm,
        fields: {
          ...prev.complaintForm?.fields,
          location: {
            ...prev.complaintForm?.fields?.location,
            blocks: [...current, newBlock.trim()]
          }
        }
      }
    }));
    setNewBlock('');
  };

  const handleRemoveBlock = (blk) => {
    const current = draftConfig.complaintForm?.fields?.location?.blocks || DEFAULT_CONFIG.complaintForm.fields.location.blocks;
    updateDraft(prev => ({
      ...prev,
      complaintForm: {
        ...prev.complaintForm,
        fields: {
          ...prev.complaintForm?.fields,
          location: {
            ...prev.complaintForm?.fields?.location,
            blocks: current.filter(b => b !== blk)
          }
        }
      }
    }));
  };

  // Ticket overrides
  const handleForceStatus = async (ticketNo, newStatus) => {
    try {
      const updated = await updateTicket(ticketNo, { status: newStatus });
      if (updated) {
        showToastMsg(`Ticket ${ticketNo} forced to ${newStatus}.`);
        const fresh = await fetchTicketsFromServer();
        setTickets(fresh);
      }
    } catch (err) {
      console.error('[Force Status Error]', err);
      showToastMsg('Failed to update ticket status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!ticketToDelete) return;
    const ticketNo = ticketToDelete.ticketNo;
    setIsDeleting(true);
    try {
      const res = await deleteTicket(ticketNo);
      if (res && res.success) {
        showToastMsg(`Ticket ${ticketNo} permanently deleted.`);
        setTickets(res.tickets || []);
        setTicketToDelete(null);
      }
    } catch (err) {
      console.error('[Delete Ticket Error]', err);
      showToastMsg(`Failed to delete ticket: ${err.message || 'Server error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchSearch = search ? (
        (t.ticketNo && t.ticketNo.toLowerCase().includes(search.toLowerCase())) ||
        (t.name && t.name.toLowerCase().includes(search.toLowerCase())) ||
        (t.issueCategory && t.issueCategory.toLowerCase().includes(search.toLowerCase()))
      ) : true;
      const matchPriority = filterPriority === 'All' ? true : t.priority === filterPriority;
      return matchSearch && matchPriority;
    });
  }, [tickets, search, filterPriority]);

  const navTabs = [
    { id: 'overview', label: 'Executive Overview', icon: ActivityIcon },
    { id: 'userportal', label: 'User Portal Studio', icon: Monitor },
    { id: 'brandingTheme', label: 'Theme & Branding', icon: Palette },
    { id: 'adminPortal', label: 'Admin Portal Studio', icon: Layout },
    { id: 'complaintForm', label: 'Complaint Form', icon: Sliders },
    { id: 'workers', label: 'Staff Roster', icon: Users, badge: (draftConfig.workers || []).length },
    { id: 'categories', label: 'Categories', icon: Layers, badge: (draftConfig.categories || []).length },
    { id: 'announcement', label: 'Broadcast Alerts', icon: Megaphone },
    { id: 'emailTemplates', label: 'Email Templates', icon: Mail },
    { id: 'features', label: 'Feature Switches', icon: Settings },
    { id: 'override', label: 'Master Tickets', icon: Wrench, badge: tickets.length },
  ];

  const issuePortalUrl = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80')
    ? '/issue/'
    : 'http://localhost:5174/issue/';

  const adminPortalUrl = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80')
    ? '/issue/admin'
    : 'http://localhost:5174/issue/admin';

  if (!authed) {
    return <SuperAdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 font-sans">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-amber-500/80 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-slide-in">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Super Admin Master Navbar */}
      <header className="bg-slate-900/90 backdrop-blur-xl border-b border-amber-500/30 sticky top-0 z-40 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-1 bg-white rounded-xl shadow-md border border-white/90 shrink-0 flex items-center justify-center">
            <CollegeLogo className="h-8 w-auto" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg text-white tracking-tight">MRF Super Admin</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                <Crown size={11} className="text-amber-400" />
                <span>Executive Command</span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Central Multi-Portal Synchronization & Theme Engine</span>
          </div>
        </div>

        {/* Action Controls & Publish Bar */}
        <div className="flex items-center gap-2.5">
          {hasUnsavedChanges && (
            <div className="flex items-center gap-2 bg-amber-950/80 border border-amber-500/60 px-3 py-1.5 rounded-xl animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs font-bold text-amber-300">Unsaved Changes</span>
              <button
                onClick={handleDiscardDraft}
                className="text-xs font-bold text-slate-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-slate-800 transition flex items-center gap-1"
                title="Discard draft changes and revert to live configuration"
              >
                <Undo size={12} /> Discard
              </button>
            </div>
          )}

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition shadow-lg cursor-pointer ${hasUnsavedChanges
              ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/30 scale-105'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
            }`}
          >
            <Save size={14} className={isPublishing ? 'animate-spin' : ''} />
            <span>{isPublishing ? 'Publishing…' : 'Publish Live to All Portals'}</span>
          </button>

          <a
            href={issuePortalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 px-3 py-2 rounded-xl transition flex items-center gap-1.5"
            title="Open Live Issue Portal"
          >
            <ExternalLink size={12} />
            <span className="hidden sm:inline">Issue Portal</span>
          </a>

          <a
            href={adminPortalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-blue-300 hover:text-white bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 px-3 py-2 rounded-xl transition flex items-center gap-1.5"
            title="Open Live Admin Portal"
          >
            <span>Admin Portal</span>
            <ArrowUpRight size={13} className="text-blue-400" />
          </a>

          <button
            onClick={handleLogout}
            className="p-2 text-red-400 hover:text-red-300 bg-red-950/60 hover:bg-red-950 rounded-xl border border-red-500/30 transition ml-2 cursor-pointer"
            title="Sign Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1">
        
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-thin">
          {navTabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${activeTab === id
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon size={14} />
              <span>{label}</span>
              {badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === id ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB 1: EXECUTIVE OVERVIEW ───────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                { label: 'Total Tickets', value: stats.total, icon: Database, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                { label: 'Unsolved', value: stats.unsolved, icon: AlertTriangle, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
                { label: 'In Progress', value: stats.ongoing, icon: Clock, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                { label: 'Solved', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Critical / Urgent', value: stats.critical, icon: Flame, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
                { label: 'Active Workers', value: stats.activeStaff, icon: Users, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`p-4 rounded-2xl border ${color} backdrop-blur-md space-y-1`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400">{label}</span>
                    <Icon size={16} />
                  </div>
                  <p className="text-2xl font-black text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <BarChart3 size={16} className="text-amber-400" />
                    <span>Stream & Classification Complaints Breakdown</span>
                  </h3>
                </div>
                <div className="space-y-3 pt-2">
                  {Object.entries(stats.streamCounts).map(([stream, count]) => {
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    return (
                      <div key={stream} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-300">{stream}</span>
                          <span className="text-slate-400">{count} tickets ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div className="bg-gradient-to-r from-amber-500 to-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Palette size={16} className="text-emerald-400" />
                    <span>Active Theme & Branding Status</span>
                  </h3>
                  <button onClick={() => setActiveTab('brandingTheme')} className="text-xs font-bold text-amber-400 hover:underline">Customize</button>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400">Primary Brand Color</span>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: draftConfig.theme?.primaryColor || '#DC2626' }} />
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span>{getFriendlyColorName(draftConfig.theme?.primaryColor)}</span>
                        <span className="text-[10px] font-mono text-slate-400">({draftConfig.theme?.primaryColor || '#DC2626'})</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400">Portal Name</span>
                    <span className="font-bold text-white">{draftConfig.branding?.portalName || 'MRF Issue Portal'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400">User Portal Availability</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${draftConfig.userPortal?.portalActive !== false ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40'}`}>
                      {draftConfig.userPortal?.portalActive !== false ? 'Online' : 'Closed'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: USER PORTAL STUDIO (HERO, TEXT, KPI CARDS & OUTAGE) ─ */}
        {activeTab === 'userportal' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Monitor size={18} className="text-emerald-400" />
                  <span>User Portal & Landing Page Studio</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Control all text, Hero headings, highlight colors, 4 KPI cards, outage screens, and portal notices dynamically.
                </p>
              </div>
            </div>

            {/* Split Screen Layout: Editor on Left, Live Interactive Preview on Right */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Form Controls (7 cols) */}
              <div className="xl:col-span-7 space-y-6">
                
                {/* 1. Hero Content & Typography */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                    <Layout size={15} className="text-amber-400" />
                    <span>Hero Section & Typography</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Hero Title Line 1</label>
                      <input
                        type="text"
                        value={draftConfig.homePage?.hero?.titleLine1 || 'Campus'}
                        onChange={(e) => updateDraft(prev => ({
                          ...prev,
                          homePage: {
                            ...prev.homePage,
                            hero: { ...prev.homePage?.hero, titleLine1: e.target.value }
                          }
                        }))}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Hero Title Line 2 (Highlighted)</label>
                      <input
                        type="text"
                        value={draftConfig.homePage?.hero?.titleLine2 || 'Maintenance'}
                        onChange={(e) => updateDraft(prev => ({
                          ...prev,
                          homePage: {
                            ...prev.homePage,
                            hero: { ...prev.homePage?.hero, titleLine2: e.target.value }
                          }
                        }))}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Official Badge Text</label>
                      <input
                        type="text"
                        value={draftConfig.homePage?.hero?.badgeText || 'OFFICIAL MCC PORTAL'}
                        onChange={(e) => updateDraft(prev => ({
                          ...prev,
                          homePage: {
                            ...prev.homePage,
                            hero: { ...prev.homePage?.hero, badgeText: e.target.value }
                          }
                        }))}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Hero Tagline</label>
                      <input
                        type="text"
                        value={draftConfig.homePage?.hero?.tagline || 'Report. Track. Resolve.'}
                        onChange={(e) => updateDraft(prev => ({
                          ...prev,
                          homePage: {
                            ...prev.homePage,
                            hero: { ...prev.homePage?.hero, tagline: e.target.value }
                          }
                        }))}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                      />
                    </div>
                  </div>

                  {/* Hero Highlight Color Chooser by Name */}
                  <div className="p-4 bg-slate-950/70 border border-slate-800/90 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-black flex items-center gap-2 text-xs">
                        <span>Hero Highlight Color</span>
                        <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          {getFriendlyColorName(draftConfig.homePage?.hero?.highlightColor || '#DC2626')}
                        </span>
                      </label>
                      <span className="text-[10px] font-mono text-slate-400">{draftConfig.homePage?.hero?.highlightColor || '#DC2626'}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <input
                        type="color"
                        value={draftConfig.homePage?.hero?.highlightColor || '#DC2626'}
                        onChange={(e) => updateDraft(prev => ({
                          ...prev,
                          homePage: {
                            ...prev.homePage,
                            hero: { ...prev.homePage?.hero, highlightColor: e.target.value }
                          }
                        }))}
                        className="w-10 h-10 rounded-xl border-2 border-slate-700 bg-slate-950 cursor-pointer p-0.5 shrink-0"
                        title="Open Color Wheel"
                      />
                      <select
                        value={PRESET_NAMED_COLORS.some(c => c.hex.toLowerCase() === (draftConfig.homePage?.hero?.highlightColor || '#DC2626').toLowerCase())
                          ? PRESET_NAMED_COLORS.find(c => c.hex.toLowerCase() === (draftConfig.homePage?.hero?.highlightColor || '#DC2626').toLowerCase())?.hex
                          : (draftConfig.homePage?.hero?.highlightColor || '#DC2626')}
                        onChange={(e) => updateDraft(prev => ({
                          ...prev,
                          homePage: {
                            ...prev.homePage,
                            hero: { ...prev.homePage?.hero, highlightColor: e.target.value }
                          }
                        }))}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs cursor-pointer"
                      >
                        {PRESET_NAMED_COLORS.map(c => (
                          <option key={c.hex} value={c.hex}>
                            {c.emoji} {c.name} ({c.hex})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quick Named Color Buttons for Hero Highlight */}
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
                        Quick Pick Color by Name:
                      </span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {PRESET_NAMED_COLORS.map(c => {
                          const isCurrent = (draftConfig.homePage?.hero?.highlightColor || '#DC2626').toLowerCase() === c.hex.toLowerCase();
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => updateDraft(prev => ({
                                ...prev,
                                homePage: {
                                  ...prev.homePage,
                                  hero: { ...prev.homePage?.hero, highlightColor: c.hex }
                                }
                              }))}
                              className={`px-1.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer select-none ${
                                isCurrent
                                  ? 'bg-slate-800 border-amber-400 text-white shadow-md ring-1 ring-amber-400/30 font-black scale-105'
                                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600'
                              }`}
                              title={`${c.name} (${c.hex})`}
                            >
                              <span>{c.emoji}</span>
                              <span className="truncate">{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-xs">Description Paragraph 1</label>
                    <textarea
                      rows={2}
                      value={draftConfig.homePage?.hero?.description1 || ''}
                      onChange={(e) => updateDraft(prev => ({
                        ...prev,
                        homePage: {
                          ...prev.homePage,
                          hero: { ...prev.homePage?.hero, description1: e.target.value }
                        }
                      }))}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs resize-none"
                    />
                  </div>
                </div>

                {/* 2. Four KPI Statistic Cards */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                    <BarChart3 size={15} className="text-blue-400" />
                    <span>4 Hero KPI Statistic Cards</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(draftConfig.homePage?.statistics?.cards || DEFAULT_CONFIG.homePage.statistics.cards).map((card, idx) => (
                      <div key={card.id || idx} className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-400">Card #{idx + 1}</span>
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={card.visible !== false}
                              onChange={(e) => {
                                const newCards = [...(draftConfig.homePage?.statistics?.cards || DEFAULT_CONFIG.homePage.statistics.cards)];
                                newCards[idx] = { ...newCards[idx], visible: e.target.checked };
                                updateDraft(prev => ({
                                  ...prev,
                                  homePage: {
                                    ...prev.homePage,
                                    statistics: { ...prev.homePage?.statistics, cards: newCards }
                                  }
                                }));
                              }}
                              className="rounded text-amber-500"
                            />
                            Visible
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Value</label>
                            <input
                              type="text"
                              value={card.value || ''}
                              onChange={(e) => {
                                const newCards = [...(draftConfig.homePage?.statistics?.cards || DEFAULT_CONFIG.homePage.statistics.cards)];
                                newCards[idx] = { ...newCards[idx], value: e.target.value };
                                updateDraft(prev => ({
                                  ...prev,
                                  homePage: {
                                    ...prev.homePage,
                                    statistics: { ...prev.homePage?.statistics, cards: newCards }
                                  }
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-black"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Label</label>
                            <input
                              type="text"
                              value={card.label || ''}
                              onChange={(e) => {
                                const newCards = [...(draftConfig.homePage?.statistics?.cards || DEFAULT_CONFIG.homePage.statistics.cards)];
                                newCards[idx] = { ...newCards[idx], label: e.target.value };
                                updateDraft(prev => ({
                                  ...prev,
                                  homePage: {
                                    ...prev.homePage,
                                    statistics: { ...prev.homePage?.statistics, cards: newCards }
                                  }
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Availability & Outage Screen Controls */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                    <Globe size={15} className="text-emerald-400" />
                    <span>Portal Online Status & Outage Controls</span>
                  </h3>

                  <div className="flex items-center justify-between p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                    <div>
                      <p className="text-xs font-black text-white">Portal Active Switch</p>
                      <p className="text-[11px] text-slate-400">When disabled, shows outage maintenance screen to complainants.</p>
                    </div>
                    <button
                      onClick={() => updateDraft(prev => ({
                        ...prev,
                        userPortal: { ...prev.userPortal, portalActive: prev.userPortal?.portalActive === false ? true : false },
                        portalActive: prev.portalActive === false ? true : false
                      }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${draftConfig.userPortal?.portalActive !== false ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40'}`}
                    >
                      {draftConfig.userPortal?.portalActive !== false ? 'Active (Online)' : 'Closed (Outage)'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Outage Screen Title</label>
                      <input
                        type="text"
                        value={draftConfig.userPortal?.closedNotice?.title || 'Portal Temporarily Closed'}
                        onChange={(e) => updateDraft(prev => ({
                          ...prev,
                          userPortal: {
                            ...prev.userPortal,
                            closedNotice: { ...prev.userPortal?.closedNotice, title: e.target.value }
                          }
                        }))}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Outage Notice Message</label>
                      <input
                        type="text"
                        value={draftConfig.userPortal?.closedNotice?.message || 'Maintenance submission is temporarily paused for upgrades.'}
                        onChange={(e) => updateDraft(prev => ({
                          ...prev,
                          userPortal: {
                            ...prev.userPortal,
                            closedNotice: { ...prev.userPortal?.closedNotice, message: e.target.value }
                          }
                        }))}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Interactive Live Preview (5 cols) */}
              <div className="xl:col-span-5 sticky top-20 space-y-4">
                <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Eye size={16} className="text-amber-400" />
                      <span className="text-xs font-black text-white">Interactive Live Preview</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button
                        onClick={() => setPreviewDevice('desktop')}
                        className={`p-1.5 rounded-lg text-xs font-bold transition ${previewDevice === 'desktop' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                      >
                        <Laptop size={13} />
                      </button>
                      <button
                        onClick={() => setPreviewDevice('mobile')}
                        className={`p-1.5 rounded-lg text-xs font-bold transition ${previewDevice === 'mobile' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                      >
                        <Smartphone size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Simulated Frame */}
                  <div className={`mx-auto transition-all duration-300 rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 p-4 space-y-4 shadow-inner ${previewDevice === 'mobile' ? 'max-w-[320px]' : 'w-full'}`}>
                    
                    {/* Simulated Badge */}
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-800 bg-white px-2.5 py-1 rounded-full shadow">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: draftConfig.homePage?.hero?.highlightColor || '#DC2626' }} />
                      <span className="uppercase tracking-wider font-extrabold">{draftConfig.homePage?.hero?.badgeText || 'OFFICIAL MCC PORTAL'}</span>
                    </div>

                    {/* Simulated Title */}
                    <div>
                      <h4 className="text-2xl font-black text-white leading-tight">
                        {draftConfig.homePage?.hero?.titleLine1 || 'Campus'} <br />
                        <span style={{ color: draftConfig.homePage?.hero?.highlightColor || '#DC2626' }}>
                          {draftConfig.homePage?.hero?.titleLine2 || 'Maintenance'}
                        </span>
                      </h4>
                      <p className="text-xs font-bold text-slate-300 mt-1">
                        {draftConfig.homePage?.hero?.tagline || 'Report. Track. Resolve.'}
                      </p>
                    </div>

                    {/* Simulated 4 KPI Cards */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {(draftConfig.homePage?.statistics?.cards || DEFAULT_CONFIG.homePage.statistics.cards)
                        .filter(c => c.visible !== false)
                        .map((c, i) => (
                          <div key={i} className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                            <p className="text-base font-black text-white">{c.value}</p>
                            <p className="text-[10px] font-bold text-amber-400 truncate">{c.label}</p>
                          </div>
                        ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 text-center italic">
                    Updates live as you edit. Click "Publish Live" to push to all portals.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── TAB 3: THEME & BRANDING STUDIO ─────────────────────── */}
        {activeTab === 'brandingTheme' && (
          <div className="space-y-6 animate-fade-in max-w-5xl">
            <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Palette size={18} className="text-indigo-400" />
                <span>Theme & Visual Branding Studio</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize color palettes, presets, and branding. Changes dynamically set CSS custom properties across all portals.
              </p>
            </div>

            {/* 1. One-Click Color Presets */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                <Palette size={15} className="text-amber-400" />
                <span>One-Click Curated Theme Presets</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {COLOR_PRESETS.map((p) => {
                  const isSelected = draftConfig.theme?.primaryColor?.toLowerCase() === p.primary.toLowerCase();
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        applyThemeColorWithHistory('primary', p.primary, p.hover);
                        updateDraft(prev => ({
                          ...prev,
                          theme: {
                            ...prev.theme,
                            accentColor: p.accent,
                          }
                        }));
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${isSelected
                        ? 'bg-slate-800 border-amber-400 shadow-lg shadow-amber-500/10 scale-102'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-black text-white">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{p.primary} / {p.accent}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full shadow-inner" style={{ backgroundColor: p.primary }} />
                        <span className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: p.accent }} />
                        {isSelected && <Check size={14} className="text-amber-400 ml-1" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Custom Color Pickers with Named Swatches & Undo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-white">Custom Theme Colors</h3>
                    <p className="text-[10px] text-slate-400">Select by Color Name or Color Picker</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleUndoThemeColor}
                      disabled={themeHistory.length === 0}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        themeHistory.length > 0
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 font-black animate-pulse'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      }`}
                      title={themeHistory.length > 0 ? "Undo last color selection" : "No previous color history"}
                    >
                      <RotateCcw size={13} className={themeHistory.length > 0 ? 'animate-spin-reverse' : ''} />
                      <span>Undo Color {themeHistory.length > 0 ? `(${themeHistory.length})` : ''}</span>
                    </button>
                  </div>
                </div>
                
                <div className="space-y-6 text-xs">
                  {/* Primary Theme Color */}
                  <div className="p-4 bg-slate-950/70 border border-slate-800/90 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-black flex items-center gap-2">
                        <span>Primary Theme Color</span>
                        <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          {getFriendlyColorName(draftConfig.theme?.primaryColor)}
                        </span>
                      </label>
                      <span className="text-[10px] font-mono text-slate-400">{draftConfig.theme?.primaryColor || '#DC2626'}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={draftConfig.theme?.primaryColor || '#DC2626'}
                        onChange={(e) => applyThemeColorWithHistory('primary', e.target.value)}
                        className="w-11 h-11 rounded-xl border-2 border-slate-700 bg-slate-950 cursor-pointer p-0.5"
                        title="Open Color Wheel"
                      />
                      <input
                        type="text"
                        value={`${getFriendlyColorName(draftConfig.theme?.primaryColor)} (${draftConfig.theme?.primaryColor || '#DC2626'})`}
                        onChange={(e) => {
                          const val = e.target.value;
                          const hexMatch = val.match(/#[0-9a-fA-F]{6}/);
                          if (hexMatch) {
                            applyThemeColorWithHistory('primary', hexMatch[0]);
                          }
                        }}
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs"
                      />
                    </div>

                    {/* Quick Named Color Buttons for Primary */}
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
                        Quick Pick by Color Name:
                      </span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {PRESET_NAMED_COLORS.map(c => {
                          const isCurrent = draftConfig.theme?.primaryColor?.toLowerCase() === c.hex.toLowerCase();
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => applyThemeColorWithHistory('primary', c.hex, c.hover)}
                              className={`px-2 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer select-none ${
                                isCurrent
                                  ? 'bg-slate-800 border-amber-400 text-white shadow-md ring-1 ring-amber-400/30 font-black scale-105'
                                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600'
                              }`}
                            >
                              <span>{c.emoji}</span>
                              <span>{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div className="p-4 bg-slate-950/70 border border-slate-800/90 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-black flex items-center gap-2">
                        <span>Accent Color</span>
                        <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                          {getFriendlyColorName(draftConfig.theme?.accentColor)}
                        </span>
                      </label>
                      <span className="text-[10px] font-mono text-slate-400">{draftConfig.theme?.accentColor || '#2563EB'}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={draftConfig.theme?.accentColor || '#2563EB'}
                        onChange={(e) => applyThemeColorWithHistory('accent', e.target.value)}
                        className="w-11 h-11 rounded-xl border-2 border-slate-700 bg-slate-950 cursor-pointer p-0.5"
                        title="Open Color Wheel"
                      />
                      <input
                        type="text"
                        value={`${getFriendlyColorName(draftConfig.theme?.accentColor)} (${draftConfig.theme?.accentColor || '#2563EB'})`}
                        onChange={(e) => {
                          const val = e.target.value;
                          const hexMatch = val.match(/#[0-9a-fA-F]{6}/);
                          if (hexMatch) {
                            applyThemeColorWithHistory('accent', hexMatch[0]);
                          }
                        }}
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs"
                      />
                    </div>

                    {/* Quick Named Color Buttons for Accent */}
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
                        Quick Pick by Color Name:
                      </span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {PRESET_NAMED_COLORS.map(c => {
                          const isCurrent = draftConfig.theme?.accentColor?.toLowerCase() === c.hex.toLowerCase();
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => applyThemeColorWithHistory('accent', c.hex)}
                              className={`px-2 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer select-none ${
                                isCurrent
                                  ? 'bg-slate-800 border-blue-400 text-white shadow-md ring-1 ring-blue-400/30 font-black scale-105'
                                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600'
                              }`}
                            >
                              <span>{c.emoji}</span>
                              <span>{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-black text-white border-b border-slate-800 pb-3">Portal Branding Names</h3>
                
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Portal Name</label>
                    <input
                      type="text"
                      value={draftConfig.branding?.portalName || 'MRF Issue Portal'}
                      onChange={(e) => updateDraft(prev => ({
                        ...prev,
                        branding: { ...prev.branding, portalName: e.target.value }
                      }))}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Organization Abbreviation</label>
                    <input
                      type="text"
                      value={draftConfig.branding?.shortOrgName || 'MCC'}
                      onChange={(e) => updateDraft(prev => ({
                        ...prev,
                        branding: { ...prev.branding, shortOrgName: e.target.value }
                      }))}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: ADMIN PORTAL STUDIO ─────────────────────────── */}
        {activeTab === 'adminPortal' && (
          <div className="space-y-6 animate-fade-in max-w-4xl">
            <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Layout size={18} className="text-blue-400" />
                <span>Admin Portal & Kanban Studio</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure SLA response time warning limits, Kanban board titles, and auto-dispatch rules.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-black text-white border-b border-slate-800 pb-3">SLA Warning Limits (Hours)</h3>
                
                <div>
                  <label className="block text-slate-400 font-bold mb-1">SLA Warning Limit (Hours)</label>
                  <input
                    type="number"
                    value={draftConfig.adminPortal?.slaWarningHours || 18}
                    onChange={(e) => updateDraft(prev => ({
                      ...prev,
                      adminPortal: { ...prev.adminPortal, slaWarningHours: parseInt(e.target.value, 10) || 18 }
                    }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Tickets older than this show an amber SLA warning badge.</p>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">SLA Critical Target (Hours)</label>
                  <input
                    type="number"
                    value={draftConfig.adminPortal?.slaCriticalHours || 24}
                    onChange={(e) => updateDraft(prev => ({
                      ...prev,
                      adminPortal: { ...prev.adminPortal, slaCriticalHours: parseInt(e.target.value, 10) || 24 },
                      slaTargetHours: parseInt(e.target.value, 10) || 24
                    }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Tickets exceeding this target show an emergency red SLA breached badge.</p>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-black text-white border-b border-slate-800 pb-3">Dispatch & Solving Toggles</h3>

                <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div>
                    <p className="font-bold text-white">Allow Worker Self-Completion</p>
                    <p className="text-[10px] text-slate-400">Enables secure 1-click tokenized resolution button in emails.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={draftConfig.features?.allowWorkerSelfComplete !== false}
                    onChange={(e) => updateDraft(prev => ({
                      ...prev,
                      features: { ...prev.features, allowWorkerSelfComplete: e.target.checked }
                    }))}
                    className="rounded text-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: COMPLAINT FORM CONTROLS ─────────────────────── */}
        {activeTab === 'complaintForm' && (
          <div className="space-y-6 animate-fade-in max-w-5xl">
            <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Sliders size={18} className="text-amber-400" />
                  <span>Complaint Form & Department Lists</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage dynamic department streams, campus location blocks, and custom problem types.
                </p>
              </div>

              {/* Add Features / New Problem Button */}
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-blue-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer select-none shrink-0"
                title="Add a custom problem or issue feature to the user complaint form"
              >
                <Plus size={15} className="stroke-[3]" />
                <span>+ Add Features / New Problem</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
              
              {/* Problem Features & Categories Manager */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 lg:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Sparkles size={16} className="text-blue-400" />
                      <span>Issue Problem Categories & Features</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">These problem types and feature categories appear dynamically in the User Complaint Form.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer self-start sm:self-auto"
                  >
                    <Plus size={13} className="stroke-[3]" />
                    <span>+ Add Features / New Problem</span>
                  </button>
                </div>
                
                <form onSubmit={handleAddProblemInline} className="flex gap-2">
                  <input
                    type="text"
                    value={newProblemInput}
                    onChange={(e) => setNewProblemInput(e.target.value)}
                    placeholder="Quick add problem feature (e.g. AC Not Cooling, Smart Board Fault, Window Repair)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <button type="submit" className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-105 transition shrink-0">
                    <Plus size={14} className="stroke-[3]" /> Add Problem
                  </button>
                </form>

                <div className="flex flex-wrap gap-2.5 max-h-60 overflow-y-auto p-1">
                  {(draftConfig.categories || DEFAULT_CONFIG.categories || INITIAL_CATEGORIES).map((cat) => (
                    <span key={cat.id || cat.label} className="inline-flex items-center gap-2 bg-slate-950 border border-slate-700 px-3.5 py-2 rounded-xl font-bold text-slate-200 shadow-xs">
                      <span className="text-blue-400">✨</span>
                      <span>{cat.label}</span>
                      {cat.prefix && <span className="text-[10px] text-slate-500 font-mono">({cat.prefix})</span>}
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id, cat.label)}
                        className="text-red-400 hover:text-red-300 ml-1 p-0.5 rounded hover:bg-red-950 transition cursor-pointer"
                        title={`Remove "${cat.label}"`}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Department List Manager */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-black text-white border-b border-slate-800 pb-3">Department Streams List</h3>
                
                <form onSubmit={handleAddDepartment} className="flex gap-2">
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="Add new department (e.g. Physics)"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <button type="submit" className="px-3.5 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl flex items-center gap-1 cursor-pointer shrink-0">
                    <Plus size={14} /> Add
                  </button>
                </form>

                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                  {(draftConfig.complaintForm?.fields?.department?.options || DEFAULT_CONFIG.complaintForm.fields.department.options).map((dept) => (
                    <span key={dept} className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl font-bold text-slate-200">
                      <span>{dept}</span>
                      <button onClick={() => handleRemoveDepartment(dept)} className="text-red-400 hover:text-red-300 ml-1">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Campus Blocks Manager */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-black text-white border-b border-slate-800 pb-3">Campus Blocks & Locations</h3>
                
                <form onSubmit={handleAddBlock} className="flex gap-2">
                  <input
                    type="text"
                    value={newBlock}
                    onChange={(e) => setNewBlock(e.target.value)}
                    placeholder="Add new block (e.g. Science Block)"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500"
                  />
                  <button type="submit" className="px-3.5 py-2 bg-blue-500 text-white font-bold rounded-xl flex items-center gap-1 cursor-pointer shrink-0">
                    <Plus size={14} /> Add
                  </button>
                </form>

                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                  {(draftConfig.complaintForm?.fields?.location?.blocks || DEFAULT_CONFIG.complaintForm.fields.location.blocks).map((blk) => (
                    <span key={blk} className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl font-bold text-slate-200">
                      <span>{blk}</span>
                      <button onClick={() => handleRemoveBlock(blk)} className="text-red-400 hover:text-red-300 ml-1">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── TAB 6: MAINTENANCE STAFF ROSTER ─────────────────────── */}
        {activeTab === 'workers' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-3xl border border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Users size={18} className="text-amber-400" />
                  <span>Maintenance Staff & Trade Allocation</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Workers configured here dynamically populate the allocation dropdown in Admin Portal in real time.
                </p>
              </div>
              <button
                onClick={() => setShowWorkerModal(true)}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Plus size={15} />
                <span>Add Maintenance Worker</span>
              </button>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-4">Staff Member</th>
                      <th className="p-4">Trade / Role</th>
                      <th className="p-4">Email Address</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {(draftConfig.workers || []).map(w => (
                      <tr key={w.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 flex items-center gap-3">
                          <span className="text-xl p-2 bg-slate-800 rounded-xl">{w.icon || '🔧'}</span>
                          <div>
                            <span className="font-black text-white block text-sm">{w.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {w.id}</span>
                          </div>
                        </td>
                        <td className="p-4 text-amber-400 font-bold">{w.role}</td>
                        <td className="p-4 text-slate-300 font-mono text-[11px]">{w.email}</td>
                        <td className="p-4 text-slate-400 font-mono">{w.phone}</td>
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleWorker(w.id)}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition ${w.active
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-900'
                              : 'bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            {w.active ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteWorker(w.id, w.name)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/60 rounded-xl transition"
                            title="Delete Worker"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 7: ISSUE CATEGORIES MASTER ──────────────────────── */}
        {activeTab === 'categories' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-3xl border border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Layers size={18} className="text-blue-400" />
                  <span>Issue Categories Master</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Categories configured here dynamically update quick-pick chips on the User Complaint Portal.
                </p>
              </div>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                <Plus size={15} />
                <span>Add Category</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(draftConfig.categories || []).map(cat => (
                <div key={cat.id} className="p-5 bg-slate-900/80 border border-slate-800 rounded-3xl space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-white">{cat.label}</span>
                    <button
                      onClick={() => handleToggleCategory(cat.id)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${cat.active ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'}`}
                    >
                      {cat.active ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 font-mono bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold">Auto-Prefix:</span>
                    {cat.prefix}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <span className="text-[11px] text-slate-500 font-mono">{cat.id}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.label)}
                      className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-1"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 8: BROADCAST CAMPUS ALERTS ──────────────────────── */}
        {activeTab === 'announcement' && (
          <div className="max-w-3xl space-y-6 animate-fade-in">
            <div className="bg-slate-900/80 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Megaphone size={18} className="text-amber-400" />
                  <span>Campus-Wide Live Announcement Banner</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Broadcasting a notice will immediately display an alert banner across the User Portal and Admin Portal.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <input
                    id="ann_enabled"
                    type="checkbox"
                    checked={draftConfig.announcement?.enabled !== false}
                    onChange={(e) => updateDraft(prev => ({
                      ...prev,
                      announcement: { ...prev.announcement, enabled: e.target.checked }
                    }))}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <label htmlFor="ann_enabled" className="font-bold text-white cursor-pointer">
                    Enable & Broadcast Announcement Banner to All Portals
                  </label>
                </div>

                <div>
                  <label className="text-slate-400 font-bold uppercase mb-1.5 block">Alert Severity Level</label>
                  <select
                    value={draftConfig.announcement?.type || 'info'}
                    onChange={(e) => updateDraft(prev => ({
                      ...prev,
                      announcement: { ...prev.announcement, type: e.target.value }
                    }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white"
                  >
                    <option value="info">🔵 Information / General Notice (Blue)</option>
                    <option value="warning">🟡 Maintenance Warning / Planned Outage (Amber)</option>
                    <option value="alert">🔴 Emergency Alert (Red)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-bold uppercase mb-1.5 block">Notice Message Content</label>
                  <textarea
                    rows={3}
                    value={draftConfig.announcement?.message || ''}
                    onChange={(e) => updateDraft(prev => ({
                      ...prev,
                      announcement: { ...prev.announcement, message: e.target.value }
                    }))}
                    placeholder="e.g. Scheduled power outage in Block B on Wednesday between 2 PM and 4 PM..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 9: EMAIL NOTIFICATION TEMPLATES ─────────────────── */}
        {activeTab === 'emailTemplates' && (
          <div className="max-w-3xl space-y-6 animate-fade-in">
            <div className="bg-slate-900/80 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Mail size={18} className="text-indigo-400" />
                  <span>Email Notification Templates</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Customize subject lines and footer texts without modifying backend SMTP security.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Admin Notification Subject</label>
                  <input
                    type="text"
                    value={draftConfig.emailTemplates?.adminNotificationSubject || ''}
                    onChange={(e) => updateDraft(prev => ({
                      ...prev,
                      emailTemplates: { ...prev.emailTemplates, adminNotificationSubject: e.target.value }
                    }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Worker Work Order Dispatch Subject</label>
                  <input
                    type="text"
                    value={draftConfig.emailTemplates?.workerDispatchSubject || ''}
                    onChange={(e) => updateDraft(prev => ({
                      ...prev,
                      emailTemplates: { ...prev.emailTemplates, workerDispatchSubject: e.target.value }
                    }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 10: FEATURE SWITCHES ────────────────────────────── */}
        {activeTab === 'features' && (
          <div className="max-w-3xl space-y-6 animate-fade-in">
            <div className="bg-slate-900/80 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Settings size={18} className="text-emerald-400" />
                <span>Feature Switchboard</span>
              </h2>

              <div className="space-y-3 text-xs">
                {[
                  { key: 'allowPhotoUpload', label: 'Allow Image/Photo Upload in Complaint Form' },
                  { key: 'allowLiveTimeline', label: 'Display Real-Time Audit Timeline on Tickets' },
                  { key: 'allowWorkerSelfComplete', label: 'Enable 1-Click Worker Email Self-Completion' },
                  { key: 'enableSmtpDispatch', label: 'Automated SMTP Email Alerts' },
                  { key: 'enableHeroKenBurns', label: 'Ken Burns Hero Background Zoom Animation' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                    <span className="font-bold text-slate-200">{label}</span>
                    <input
                      type="checkbox"
                      checked={draftConfig.features?.[key] !== false}
                      onChange={(e) => updateDraft(prev => ({
                        ...prev,
                        features: { ...prev.features, [key]: e.target.checked }
                      }))}
                      className="rounded text-amber-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 11: MASTER TICKET OVERRIDE & AUDIT ──────────────── */}
        {activeTab === 'override' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-3xl border border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Wrench size={18} className="text-rose-400" />
                  <span>Master Ticket Override & Permanent Purge</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Super Admin privileges: Force change ticket statuses or permanently delete spam complaints.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tickets..."
                    className="px-3.5 py-2 pl-9 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>

                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="All">All Priorities</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-4">Ticket ID</th>
                      <th className="p-4">Complainant</th>
                      <th className="p-4">Category & Location</th>
                      <th className="p-4">Priority</th>
                      <th className="p-4">Current Status</th>
                      <th className="p-4">Super Admin Override</th>
                      <th className="p-4 text-right">Purge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {filteredTickets.map(t => (
                      <tr key={t.ticketNo} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-black font-mono text-amber-400">{t.ticketNo}</td>
                        <td className="p-4">
                          <span className="font-bold text-white block">{t.name}</span>
                          <span className="text-[10px] text-slate-400">{t.department} ({t.userType})</span>
                        </td>
                        <td className="p-4">
                          <span className="text-slate-200 block font-bold">{t.issueCategory}</span>
                          <span className="text-[10px] text-slate-500">Block {t.block || 'Campus'}, Room {t.roomNo || 'N/A'}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${t.priority === 'Critical' ? 'bg-red-950 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-300'}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${t.status === 'Completed'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                            : t.status === 'Ongoing'
                              ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                              : 'bg-red-950 text-red-400 border border-red-500/40'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleForceStatus(t.ticketNo, 'Unsolved')}
                              className="px-2 py-1 bg-slate-800 hover:bg-red-950 hover:text-red-400 rounded-lg text-[10px] font-bold transition"
                            >
                              Unsolved
                            </button>
                            <button
                              onClick={() => handleForceStatus(t.ticketNo, 'Ongoing')}
                              className="px-2 py-1 bg-slate-800 hover:bg-amber-950 hover:text-amber-400 rounded-lg text-[10px] font-bold transition"
                            >
                              Ongoing
                            </button>
                            <button
                              onClick={() => handleForceStatus(t.ticketNo, 'Completed')}
                              className="px-2 py-1 bg-slate-800 hover:bg-emerald-950 hover:text-emerald-400 rounded-lg text-[10px] font-bold transition"
                            >
                              Solved
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setTicketToDelete(t)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/80 rounded-xl transition cursor-pointer"
                            title="Permanently Delete Ticket"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL: Add Worker ─────────────────────────────────────── */}
      {showWorkerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Users size={16} className="text-amber-400" />
                <span>Add Maintenance Worker</span>
              </h3>
              <button onClick={() => setShowWorkerModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddWorker} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Worker Name *</label>
                <input
                  type="text"
                  required
                  value={workerForm.name}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Ramesh Babu"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Specialized Trade / Role *</label>
                <input
                  type="text"
                  required
                  value={workerForm.role}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g. HVAC & AC Maintenance Lead"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Email for Work Order Dispatch</label>
                <input
                  type="email"
                  value={workerForm.email}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="worker@mrf.edu"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={workerForm.phone}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98400 12345"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer text-xs"
              >
                Save & Add to Active Roster
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Add Features / New Problem ───────────────────────────── */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-blue-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Add Features / New Problem</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Add a maintenance problem type or feature to Complaint Form</p>
                </div>
              </div>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Problem / Feature Name with Emoji *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={categoryForm.label}
                  onChange={(e) => {
                    setCategoryForm(prev => ({
                      ...prev,
                      label: e.target.value,
                      prefix: prev.prefix || `${e.target.value.replace(/^[^\w\s]+/, '').trim()} issue: `
                    }));
                  }}
                  placeholder="e.g. ❄️ Air Conditioner Fault, 💡 Projector Issue"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Auto-Prefix for Description (Optional)</label>
                <input
                  type="text"
                  value={categoryForm.prefix}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, prefix: e.target.value }))}
                  placeholder="e.g. AC issue: "
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono text-xs focus:border-blue-500 outline-none transition"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-3 rounded-xl shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Plus size={15} className="stroke-[3]" />
                <span>Save & Add Problem Feature</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Delete Confirmation Inside Website ────────────────── */}
      {ticketToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-scale-in text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold border border-red-500/30">
                  <Trash2 size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Permanently Purge Ticket</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Irreversible database action</p>
                </div>
              </div>
              <button
                onClick={() => !isDeleting && setTicketToDelete(null)}
                disabled={isDeleting}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Ticket Number:</span>
                <span className="font-mono font-black text-red-400 bg-red-950/80 px-2.5 py-0.5 rounded-lg border border-red-800/60 text-sm">
                  {ticketToDelete.ticketNo}
                </span>
              </div>
              {ticketToDelete.name && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Complainant:</span>
                  <span className="font-bold text-slate-200">{ticketToDelete.name}</span>
                </div>
              )}
              {ticketToDelete.issueCategory && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Issue Category:</span>
                  <span className="font-semibold text-slate-300">{ticketToDelete.issueCategory}</span>
                </div>
              )}
              {ticketToDelete.block && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Location:</span>
                  <span className="font-medium text-slate-300">{ticketToDelete.block} {ticketToDelete.roomNo ? `(Room ${ticketToDelete.roomNo})` : ''}</span>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs leading-relaxed flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 text-red-400 mt-0.5" />
              <span>
                Are you sure you want to permanently purge <strong>{ticketToDelete.ticketNo}</strong>? This ticket will be completely removed from all portals and cannot be recovered.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTicketToDelete(null)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-98 transition flex items-center gap-2 cursor-pointer text-xs disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Purging...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Yes, Purge Ticket</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ActivityIcon(props) {
  return <BarChart3 {...props} />;
}
