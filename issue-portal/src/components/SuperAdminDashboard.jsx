/**
 * SuperAdminDashboard.jsx — Master Dynamic Control Center for MRF Campus Portal
 * Controls both User Portal and Admin Portal dynamically in real-time.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SuperAdminLogin from './SuperAdminLogin.jsx';
import CollegeLogo from './CollegeLogo.jsx';
import {
  getTickets, updateTicket, fetchTicketsFromServer
} from '../ticketsStore.js';
import {
  getSystemConfig, saveSystemConfig, fetchSystemConfigFromServer, DEFAULT_CONFIG
} from '../systemConfigStore.js';
import {
  Crown, ShieldCheck, Activity, Users, Layers, Megaphone,
  Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, RefreshCw,
  LogOut, Download, Search, Filter, Wrench, Building2, Bell,
  Flame, Clock, ChevronRight, Check, X, ShieldAlert, Sparkles,
  ArrowUpRight, BarChart3, Database, Save, Lock
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [tickets, setTickets] = useState(() => getTickets());
  const [config, setConfig] = useState(() => getSystemConfig());
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'workers' | 'categories' | 'announcement' | 'override'
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('All');

  // Worker Modal / Form state
  const [workerForm, setWorkerForm] = useState({ name: '', role: '', email: '', phone: '', icon: '🔧' });
  const [showWorkerModal, setShowWorkerModal] = useState(false);

  // Category Modal / Form state
  const [categoryForm, setCategoryForm] = useState({ label: '', prefix: '', color: 'blue' });
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Sync data from server
  const refreshAll = useCallback(async () => {
    const [freshTickets, freshConfig] = await Promise.all([
      fetchTicketsFromServer(),
      fetchSystemConfigFromServer(),
    ]);
    setTickets(freshTickets);
    setConfig(freshConfig);
  }, []);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 2000);
    const handleStorage = (e) => {
      if (e.key === 'mrf_tickets' || e.key === 'mrf_system_config') {
        refreshAll();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [refreshAll]);

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ── Worker Operations ─────────────────────────────────────────
  const handleAddWorker = (e) => {
    e.preventDefault();
    if (!workerForm.name.trim() || !workerForm.role.trim()) {
      showToastMsg('Worker name and role are required.');
      return;
    }
    const newWorker = {
      id: `w-${Date.now()}`,
      name: workerForm.name.trim(),
      role: workerForm.role.trim(),
      email: workerForm.email.trim() || `${workerForm.name.toLowerCase().replace(/\s+/g, '.')}@mrf.edu`,
      phone: workerForm.phone.trim() || '+91 98400 00000',
      icon: workerForm.icon || '🔧',
      active: true,
    };
    const updated = { ...config, workers: [...(config.workers || []), newWorker] };
    setConfig(updated);
    saveSystemConfig(updated);
    setWorkerForm({ name: '', role: '', email: '', phone: '', icon: '🔧' });
    setShowWorkerModal(false);
    showToastMsg(`Added maintenance staff "${newWorker.name}"!`);
  };

  const handleToggleWorker = (id) => {
    const updatedWorkers = (config.workers || []).map(w =>
      w.id === id ? { ...w, active: !w.active } : w
    );
    const updated = { ...config, workers: updatedWorkers };
    setConfig(updated);
    saveSystemConfig(updated);
    showToastMsg('Worker status updated.');
  };

  const handleDeleteWorker = (id, name) => {
    if (!window.confirm(`Are you sure you want to remove worker "${name}"?`)) return;
    const updatedWorkers = (config.workers || []).filter(w => w.id !== id);
    const updated = { ...config, workers: updatedWorkers };
    setConfig(updated);
    saveSystemConfig(updated);
    showToastMsg(`Removed worker "${name}".`);
  };

  // ── Category Operations ───────────────────────────────────────
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!categoryForm.label.trim()) {
      showToastMsg('Category label is required.');
      return;
    }
    const newCat = {
      id: `cat-${Date.now()}`,
      label: categoryForm.label.trim(),
      prefix: categoryForm.prefix.trim() || `${categoryForm.label.trim()}: `,
      active: true,
      color: categoryForm.color || 'blue',
    };
    const updated = { ...config, categories: [...(config.categories || []), newCat] };
    setConfig(updated);
    saveSystemConfig(updated);
    setCategoryForm({ label: '', prefix: '', color: 'blue' });
    setShowCategoryModal(false);
    showToastMsg(`Added new category "${newCat.label}"!`);
  };

  const handleToggleCategory = (id) => {
    const updatedCats = (config.categories || []).map(c =>
      c.id === id ? { ...c, active: !c.active } : c
    );
    const updated = { ...config, categories: updatedCats };
    setConfig(updated);
    saveSystemConfig(updated);
    showToastMsg('Category status updated.');
  };

  const handleDeleteCategory = (id, label) => {
    if (!window.confirm(`Delete category "${label}"?`)) return;
    const updatedCats = (config.categories || []).filter(c => c.id !== id);
    const updated = { ...config, categories: updatedCats };
    setConfig(updated);
    saveSystemConfig(updated);
    showToastMsg(`Removed category "${label}".`);
  };

  // ── Announcement Broadcast Operations ────────────────────────
  const handleSaveAnnouncement = (ann) => {
    const updated = {
      ...config,
      announcement: {
        ...ann,
        lastUpdated: new Date().toISOString(),
      }
    };
    setConfig(updated);
    saveSystemConfig(updated);
    showToastMsg('Broadcast announcement updated across all portals!');
  };

  // ── Ticket Master Override Operations ────────────────────────
  const handleForceStatus = async (ticketNo, newStatus) => {
    await updateTicket(ticketNo, { status: newStatus });
    await refreshAll();
    showToastMsg(`Ticket ${ticketNo} overridden to ${newStatus}.`);
  };

  const handleDeleteTicket = async (ticketNo) => {
    if (!window.confirm(`PERMANENT ACTION: Are you sure you want to completely delete ticket ${ticketNo}?`)) return;
    
    // Attempt backend delete
    try {
      await fetch(`http://localhost:5000/api/tickets/${encodeURIComponent(ticketNo)}`, { method: 'DELETE' });
    } catch {}

    const updated = tickets.filter(t => t.ticketNo !== ticketNo);
    localStorage.setItem('mrf_tickets', JSON.stringify(updated));
    setTickets(updated);
    showToastMsg(`Ticket ${ticketNo} deleted permanently.`);
  };

  // ── Export System Data ────────────────────────────────────────
  const handleExportAll = () => {
    const dump = {
      exportedAt: new Date().toISOString(),
      tickets,
      config,
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dump, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `mrf_master_backup_${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToastMsg('Master database dump exported!');
  };

  // ── Calculations ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = tickets.length;
    const unsolved = tickets.filter(t => t.status === 'Unsolved').length;
    const ongoing = tickets.filter(t => t.status === 'Ongoing').length;
    const completed = tickets.filter(t => t.status === 'Completed').length;
    const critical = tickets.filter(t => t.priority === 'Critical' && t.status !== 'Completed').length;
    const activeStaff = (config.workers || []).filter(w => w.active).length;

    // Stream distribution
    const streamCounts = {
      'Aided UG': tickets.filter(t => t.userType === 'Student' && t.studentStream === 'Aided' && t.studentLevel === 'UG').length,
      'Aided PG': tickets.filter(t => t.userType === 'Student' && t.studentStream === 'Aided' && t.studentLevel === 'PG').length,
      'SFS UG':   tickets.filter(t => t.userType === 'Student' && t.studentStream === 'SFS' && t.studentLevel === 'UG').length,
      'SFS PG':   tickets.filter(t => t.userType === 'Student' && t.studentStream === 'SFS' && t.studentLevel === 'PG').length,
      'Staff':    tickets.filter(t => t.userType === 'Staff').length,
      'Units':    tickets.filter(t => t.userType === 'Unit').length,
    };

    return { total, unsolved, ongoing, completed, critical, activeStaff, streamCounts };
  }, [tickets, config]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchSearch =
        t.ticketNo?.toLowerCase().includes(search.toLowerCase()) ||
        t.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.department?.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase());
      const matchPri = filterPriority === 'All' || t.priority === filterPriority;
      return matchSearch && matchPri;
    });
  }, [tickets, search, filterPriority]);

  if (!authed) {
    return <SuperAdminLogin onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#070C18] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-slate-950 font-black text-xs px-5 py-3.5 rounded-2xl shadow-2xl animate-scale-in flex items-center gap-2 border border-amber-300">
          <Sparkles size={16} />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Super Admin Master Navbar */}
      <header className="bg-slate-900/90 backdrop-blur-xl border-b border-amber-500/30 sticky top-0 z-40 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white rounded-xl shadow-md border border-white/90 shrink-0 flex items-center justify-center">
            <CollegeLogo className="h-9 w-auto" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg text-white tracking-tight">MRF Super Admin</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                <Crown size={11} className="text-amber-400" />
                <span>Executive Command</span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Global Facilities & Real-time Portal Orchestrator</span>
          </div>
        </div>

        {/* Global Links & Switcher */}
        <div className="flex items-center gap-2.5">
          <a
            href="/issue/"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
          >
            <span>User Portal</span>
            <ArrowUpRight size={13} className="text-slate-400" />
          </a>

          <a
            href="/admin/"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-blue-300 hover:text-white bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
          >
            <span>Admin Kanban</span>
            <ArrowUpRight size={13} className="text-blue-400" />
          </a>

          <button
            onClick={refreshAll}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl border border-slate-700 transition"
            title="Refresh All Data"
          >
            <RefreshCw size={15} />
          </button>

          <button
            onClick={handleExportAll}
            className="text-xs font-bold text-amber-300 bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
          >
            <Database size={13} />
            <span>Backup Data</span>
          </button>

          <button
            onClick={() => setAuthed(false)}
            className="p-2 text-red-400 hover:text-red-300 bg-red-950/60 rounded-xl border border-red-500/30 transition ml-2"
            title="Sign Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Broadcast Banner Live Ticker */}
      {config.announcement?.enabled && config.announcement?.message && (
        <div className={`px-6 py-2 text-xs font-bold flex items-center justify-between border-b ${
          config.announcement.type === 'alert'
            ? 'bg-red-950/90 text-red-200 border-red-500/40'
            : config.announcement.type === 'warning'
            ? 'bg-amber-950/90 text-amber-200 border-amber-500/40'
            : 'bg-blue-950/90 text-blue-200 border-blue-500/40'
        }`}>
          <div className="flex items-center gap-2 max-w-5xl truncate">
            <Megaphone size={14} className="shrink-0 animate-bounce" />
            <span className="uppercase text-[10px] font-black tracking-wider px-1.5 py-0.5 bg-black/40 rounded">Live Broadcast</span>
            <span className="truncate">{config.announcement.message}</span>
          </div>
          <span className="text-[10px] text-slate-400 hidden sm:inline">Active across User & Admin portals</span>
        </div>
      )}

      {/* Main Command Dashboard Layout */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8 flex-1">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
          {[
            { id: 'overview',     label: 'Executive Overview', icon: Activity },
            { id: 'workers',      label: 'Maintenance Staff',  icon: Users, badge: (config.workers || []).length },
            { id: 'categories',   label: 'Issue Categories',   icon: Layers, badge: (config.categories || []).length },
            { id: 'announcement', label: 'Broadcast Alerts',   icon: Megaphone },
            { id: 'override',     label: 'Master Tickets',     icon: Wrench, badge: tickets.length },
          ].map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeTab === id
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon size={14} />
              <span>{label}</span>
              {badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === id ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB 1: EXECUTIVE OVERVIEW ───────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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

            {/* Stream Breakdown & Live Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Academic Streams Distribution */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-amber-400" />
                    <h3 className="text-sm font-black text-white">Stream & Unit Complaints Volume</h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-semibold">Live Distribution</span>
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
                          <div
                            className="bg-gradient-to-r from-amber-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Maintenance Staff Readiness */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-blue-400" />
                    <h3 className="text-sm font-black text-white">Maintenance Team Roster</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('workers')}
                    className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
                  >
                    Manage Roster <ChevronRight size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {(config.workers || []).map(w => (
                    <div key={w.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-lg">{w.icon || '🔧'}</span>
                        <div className="truncate">
                          <p className="text-xs font-black text-white truncate">{w.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold truncate">{w.role}</p>
                        </div>
                      </div>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${w.active ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: MAINTENANCE WORKERS MANAGEMENT ───────────────── */}
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

            {/* Workers Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-4">Staff Member</th>
                      <th className="p-4">Trade / Specialization</th>
                      <th className="p-4">Email Address</th>
                      <th className="p-4">Contact Phone</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {(config.workers || []).map(w => (
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
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition ${
                              w.active
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

        {/* ── TAB 3: ISSUE CATEGORIES MASTER ──────────────────────── */}
        {activeTab === 'categories' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-3xl border border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Layers size={18} className="text-blue-400" />
                  <span>Issue Categories Master</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Categories configured here dynamically update the quick-pick chips on the User Complaint Portal.
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
              {(config.categories || []).map(cat => (
                <div key={cat.id} className="p-5 bg-slate-900/80 border border-slate-800 rounded-3xl space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-white">{cat.label}</span>
                    <button
                      onClick={() => handleToggleCategory(cat.id)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        cat.active ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
                      }`}
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

        {/* ── TAB 4: BROADCAST CAMPUS ALERTS ──────────────────────── */}
        {activeTab === 'announcement' && (
          <div className="max-w-3xl space-y-6 animate-fade-in">
            <div className="bg-slate-900/80 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Megaphone size={18} className="text-amber-400" />
                  <span>Campus-Wide Live Announcement Banner</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Broadcasting a notice will immediately display a prominent alert banner at the top of the User Portal and Admin Portal.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target;
                  handleSaveAnnouncement({
                    enabled: form.enabled.checked,
                    message: form.message.value.trim(),
                    type: form.type.value,
                  });
                }}
                className="space-y-4"
              >
                {/* Active Toggle */}
                <div className="flex items-center gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <input
                    id="enabled"
                    name="enabled"
                    type="checkbox"
                    defaultChecked={config.announcement?.enabled}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500/20"
                  />
                  <label htmlFor="enabled" className="text-xs font-bold text-white cursor-pointer">
                    Enable & Broadcast Announcement Banner to All Portals
                  </label>
                </div>

                {/* Severity Type */}
                <div>
                  <label className="input-label text-slate-400 text-xs font-bold uppercase mb-1.5 block">Alert Severity Level</label>
                  <select
                    name="type"
                    defaultValue={config.announcement?.type || 'info'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="info">🔵 Information / General Notice (Blue)</option>
                    <option value="warning">🟡 Maintenance Warning / Planned Outage (Amber)</option>
                    <option value="alert">🔴 Emergency Alert (Red)</option>
                  </select>
                </div>

                {/* Message Text */}
                <div>
                  <label className="input-label text-slate-400 text-xs font-bold uppercase mb-1.5 block">Notice Message Content</label>
                  <textarea
                    name="message"
                    rows={3}
                    defaultValue={config.announcement?.message || ''}
                    placeholder="e.g. Scheduled power outage in Block B on Wednesday between 2 PM and 4 PM..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs resize-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Save size={15} />
                  <span>Publish Announcement to All Portals</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── TAB 5: MASTER TICKET OVERRIDE & AUDIT ─────────────────── */}
        {activeTab === 'override' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-3xl border border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Wrench size={18} className="text-rose-400" />
                  <span>Master Ticket Override & Audit Log</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Super Admin privileges: Force change ticket statuses or permanently purge spam/invalid complaints.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tickets..."
                    className="px-3.5 py-2 pl-9 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-500/20"
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

            {/* Tickets Table */}
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
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            t.priority === 'Critical' ? 'bg-red-950 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${
                            t.status === 'Completed'
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
                            onClick={() => handleDeleteTicket(t.ticketNo)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/80 rounded-xl transition"
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

      {/* ── MODAL: Add Category ───────────────────────────────────── */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-blue-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Layers size={16} className="text-blue-400" />
                <span>Add Issue Category</span>
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Category Label with Emoji *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.label}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g. ❄️ HVAC & Air Conditioning"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Auto-Prefix for Description</label>
                <input
                  type="text"
                  value={categoryForm.prefix}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, prefix: e.target.value }))}
                  placeholder="e.g. HVAC Issue: "
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl shadow-lg shadow-blue-500/20 cursor-pointer text-xs"
              >
                Save & Publish to User Portal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
