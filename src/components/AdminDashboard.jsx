/**
 * AdminDashboard.jsx — Master Animated Admin Portal (Purely Admin Options)
 * Features rich micro-interactions, animated live radar indicators, interactive worker dispatch, and fluid transitions.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AdminLogin from './AdminLogin.jsx';
import StatsBar from './StatsBar.jsx';
import KanbanBoard from './KanbanBoard.jsx';
import TicketDetailModal from './TicketDetailModal.jsx';
import WorkerEmailModal from './WorkerEmailModal.jsx';
import WorkTracker from './WorkTracker.jsx';
import WorkHistoryView from './WorkHistoryView.jsx';
import WorkTimelineModal from './WorkTimelineModal.jsx';
import { getTickets, updateTicket, fetchTicketsFromServer } from '../ticketsStore.js';
import { sendCompletionEmail, sendWorkerAssignmentEmail } from '../emailService.js';
import { getSystemConfig, fetchSystemConfigFromServer } from '../systemConfigStore.js';
import CollegeLogo from './CollegeLogo.jsx';
import {
  LogOut, RefreshCw, Search, LayoutDashboard, Filter,
  SlidersHorizontal, Shield, CheckCircle2, Users, Activity, Download, Wrench, Send, Sparkles, Mail, History,
  Crown, Megaphone
} from 'lucide-react';

import { WORKERS } from '../constants.js';

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    document.title = 'MCC Admin Portal — Campus Facilities';
  }, []);
  const [tickets, setTickets] = useState(() => getTickets());
  const [systemConfig, setSystemConfig] = useState(() => getSystemConfig());
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [timelineTicket, setTimelineTicket] = useState(null);
  const [historyViewMode, setHistoryViewMode] = useState(null); // 'TOTAL' | 'PENDING' | 'URGENT' | 'COMPLETED' | null
  const [emailingWorker, setEmailingWorker] = useState(null);
  const [toast, setToast] = useState(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterUrgent, setFilterUrgent] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTickets = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    const [fresh, freshCfg] = await Promise.all([
      fetchTicketsFromServer(),
      fetchSystemConfigFromServer(),
    ]);
    setTickets(prev => {
      if (prev === fresh) return prev;
      return fresh;
    });
    if (freshCfg) setSystemConfig(freshCfg);
    if (manual) {
      setTimeout(() => setIsRefreshing(false), 400);
      showToast('Dashboard refreshed with latest complaints & staff updates!');
    }
  }, []);

  const dynamicWorkers = useMemo(() => {
    return (systemConfig.workers || WORKERS).filter(w => w.active !== false);
  }, [systemConfig]);

  // Poll server safely when visible and sync instantly via BroadcastChannel
  useEffect(() => {
    refreshTickets();

    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshTickets();
    }, 3500);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshTickets();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window
      ? new BroadcastChannel('mrf_tickets_sync_channel')
      : null;

    if (channel) {
      channel.onmessage = (e) => {
        if (e.data && e.data.type === 'TICKETS_UPDATED' && Array.isArray(e.data.tickets)) {
          setTickets(e.data.tickets);
        }
      };
    }

    return () => {
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channel) channel.close();
    };
  }, [refreshTickets]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 4500);
  };

  const handleSolveTicket = async (ticket) => {
    if (ticket.status === 'Completed') {
      await updateTicket(ticket.ticketNo, { status: 'Archived' });
      await refreshTickets();
      showToast(`Ticket ${ticket.ticketNo} removed & archived from board!`);
      return;
    }

    const updated = await updateTicket(ticket.ticketNo, { status: 'Completed' });
    await refreshTickets();

    await sendCompletionEmail({
      to_email: ticket.email,
      to_name: ticket.name,
      ticket_no: ticket.ticketNo,
    });

    showToast(`Ticket ${ticket.ticketNo} marked as Solved! Resolution email sent to ${ticket.email}.`);
  };

  const handleAssignWorker = async (ticketNo, workerName) => {
    if (!ticketNo || !workerName) return;

    const current = tickets.find(t => t.ticketNo === ticketNo);
    if (!current) return;

    const workerObj = dynamicWorkers.find(w => w.name === workerName) || { name: workerName, role: 'Maintenance Staff', email: '' };

    const updates = {
      assignedWorker: workerName,
      status: current.status === 'Unsolved' ? 'Ongoing' : current.status,
    };

    const updated = await updateTicket(ticketNo, updates);
    await refreshTickets();

    try {
      await fetch('http://localhost:5000/api/send-worker-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: workerObj.email,
          to_name: workerObj.name,
          ticket_no: ticketNo,
          subject: `Work Order Dispatched: ${ticketNo} [${current.issueCategory || 'General Maintenance'}]`,
          message: `You have been dispatched to Ticket ${ticketNo} [${current.issueCategory || 'General Maintenance'}] at ${current.block || 'Main Campus'} (Room ${current.roomNo || 'N/A'}).\n\nTask Details:\n${current.description || 'Please inspect and complete the required repairs.'}\n\nWhen complete on site, please click the COMPLETED button below to update the system.`,
          location: `${current.block || 'Main Campus'} (Room ${current.roomNo || 'N/A'})`,
          issueCategory: current.issueCategory || 'General Maintenance',
          sender_name: 'Campus Facilities Administrator',
        }),
      });
    } catch (err) {
      console.error('[Worker Dispatch Email Error]', err);
    }

    showToast(`Work Order ${ticketNo} assigned & dispatched to ${workerName} with COMPLETED button!`);
  };

  const handleLogout = () => setAuthed(false);

  const handleTicketUpdate = (updated) => {
    setTickets(prev =>
      prev.map(t => t.ticketNo === updated.ticketNo ? updated : t)
    );
    setSelectedTicket(updated);
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tickets, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `mrf_tickets_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const { Unsolved: allUnsolved, Ongoing: allOngoing, Completed: allCompleted } = useMemo(() => {
    let filtered = tickets;

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.ticketNo.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.department.toLowerCase().includes(q) ||
        t.block.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'All') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    if (filterType !== 'All') {
      filtered = filtered.filter(t => t.userType === filterType);
    }

    if (filterUrgent) {
      filtered = filtered.filter(t => {
        if (t.isUrgent) return true;
        if (t.status === 'Completed') return false;
        return (Date.now() - new Date(t.createdAt).getTime()) > 48 * 36e5;
      });
    }

    return {
      Unsolved: filtered.filter(t => t.status === 'Unsolved'),
      Ongoing: filtered.filter(t => t.status === 'Ongoing'),
      Completed: filtered.filter(t => t.status === 'Completed'),
    };
  }, [tickets, search, filterStatus, filterType, filterUrgent]);

  const activeTicketForTracker = useMemo(() => {
    const pending = tickets.filter(t => t.status !== 'Completed');
    return pending.length > 0 ? pending[pending.length - 1] : tickets[tickets.length - 1] || null;
  }, [tickets]);

  const activityLog = useMemo(() => {
    return tickets
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 5);
  }, [tickets]);

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col selection:bg-[#A00000] selection:text-white relative overflow-x-hidden">
      {/* Dynamic Animated Ambient Background Orbs */}
      <div className="fixed top-[-10%] left-[-5%] w-[45rem] h-[45rem] bg-[#A00000]/5 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[45rem] h-[45rem] bg-[#A00000]/5 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Toast Notification with Spring Pop-In */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up bg-slate-900/95 backdrop-blur-md text-white text-xs font-semibold px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3 max-w-md">
          <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <span className="leading-snug">{toast}</span>
        </div>
      )}

      {/* Admin Navbar — Floating Glassmorphism Header */}
      <nav className="glass-panel border-b border-[#E5E5E5] sticky top-0 z-40 transition-all duration-300 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 sm:px-8 py-3.5">
          <div className="flex items-center gap-4 group cursor-pointer">
            <CollegeLogo className="h-14 sm:h-16 w-auto shrink-0" />
            <div>
              <div className="flex items-center gap-2.5">
                <p className="font-black text-[#111111] text-lg sm:text-xl tracking-tight leading-tight">
                  MCC Admin Dashboard
                </p>
                {/* Live Radar Pulsing Connected Badge */}
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Connected to Server
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-tight mt-0.5">
                Campus Facilities Management & Maintenance Dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => refreshTickets(true)}
              disabled={isRefreshing}
              title="Refresh tickets data"
              className="px-3.5 py-2 rounded-xl text-[#111111] hover:text-[#A00000] hover:bg-[#FFF5F5] border border-[#E5E5E5] hover:border-[#A00000]/30 transition-all duration-200 flex items-center gap-2 text-xs font-bold active:scale-95 shadow-2xs cursor-pointer disabled:opacity-60 bg-white"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#A00000]' : ''} />
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleExport}
              title="Export Tickets Data to JSON"
              className="hidden sm:flex items-center gap-1.5 text-xs text-[#111111] hover:text-[#A00000] hover:bg-[#FFF5F5] font-bold px-3.5 py-2 rounded-xl border border-[#E5E5E5] hover:border-[#A00000]/30 transition-all duration-200 active:scale-95 bg-white shadow-2xs cursor-pointer"
            >
              <Download size={14} className="text-slate-500" />
              Export Data
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-[#A00000] hover:bg-[#A00000] hover:text-white border border-[#A00000]/30 font-bold px-3.5 py-2 rounded-xl transition-all duration-200 active:scale-95 bg-white shadow-2xs cursor-pointer"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              Campus Facilities Control Board
              <Sparkles size={22} className="text-amber-500 animate-float-gentle hidden sm:inline" />
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1 font-normal">
              Review complaints, assign workers, and click <strong className="font-bold text-slate-800">Solve</strong> to notify users automatically.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 bg-white border border-slate-200/80 rounded-2xl px-3.5 py-2 font-bold shadow-sm flex items-center gap-2 hover-card-lift">
              <Activity size={15} className="text-emerald-500 animate-pulse" />
              Server Connected (Port 5000)
            </span>
          </div>
        </div>

        {/* Animated & Clickable Stats Bar */}
        <StatsBar
          tickets={tickets}
          activeCategory={historyViewMode}
          onSelectCategory={(cat) => setHistoryViewMode(cat)}
        />

        {historyViewMode ? (
          /* Dedicated Work & Complaint History View */
          <WorkHistoryView
            tickets={tickets}
            initialCategory={historyViewMode}
            onBackToDashboard={() => setHistoryViewMode(null)}
            onOpenTimeline={(t) => setTimelineTicket(t)}
            onRefresh={refreshTickets}
          />
        ) : (
          /* Standard Live Command Center & Control Board */
          <>
            {/* Dynamic Progress Timeline Tracker */}
            {activeTicketForTracker && (
              <WorkTracker ticket={activeTicketForTracker} />
            )}

            {/* Full-Width Facilities Maintenance Personnel Roster & Task Dispatch */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.04)] space-y-6 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <h2 className="text-sm sm:text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#FFF5F5] text-[#A00000] border border-[#A00000]/20 shrink-0">
                      <Wrench size={18} />
                    </div>
                    Facilities Maintenance Roster & Task Dispatch
                  </h2>
                  <p className="text-xs text-slate-500 font-medium sm:pl-10">
                    Select an unassigned complaint to dispatch work orders directly to campus maintenance staff.
                  </p>
                </div>
                <span className="text-xs font-black text-[#A00000] bg-[#FFF5F5] border border-[#A00000]/30 px-3.5 py-1.5 rounded-full shrink-0 flex items-center gap-1.5 self-start sm:self-auto shadow-2xs">
                  <Users size={14} className="text-[#A00000] animate-pulse" />
                  {dynamicWorkers.length} Maintenance Staff Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dynamicWorkers.map(w => {
                  const assignedTickets = tickets.filter(t => t.assignedWorker === w.name && t.status !== 'Completed');
                  const isBusy = assignedTickets.length > 0;
                  const pendingUnassigned = tickets.filter(t => t.status === 'Unsolved' || !t.assignedWorker);

                  return (
                    <div
                      key={w.name}
                      className="bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-[#A00000]/50 hover:shadow-xl rounded-2xl p-5 space-y-4 transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
                    >
                      <div className="space-y-3">
                        {/* Worker Info Header */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-900 leading-tight truncate">{w.name}</p>
                          <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{w.role}</p>
                        </div>

                        {/* Worker Email Row */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/70 text-[11px] text-slate-600 font-mono shadow-2xs">
                          <Mail size={12} className="text-[#A00000] shrink-0" />
                          <span className="truncate text-[11px] font-semibold">{w.email}</span>
                        </div>

                        {/* Active Work Load Status & Direct Email "Send" Button */}
                        <div className="pt-1 flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full border shadow-2xs transition-all duration-300 ${isBusy
                            ? 'bg-amber-50 text-amber-800 border-amber-200/80 animate-pulse'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            }`}>
                            <span className={`w-2 h-2 rounded-full ${isBusy ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                            {isBusy ? `${assignedTickets.length} Task${assignedTickets.length > 1 ? 's' : ''}` : 'Available'}
                          </span>

                          {/* Direct Send Email Button */}
                          <button
                            type="button"
                            onClick={() => setEmailingWorker(w)}
                            title={`Send direct instruction email to ${w.name}`}
                            className="text-xs font-black text-[#A00000] hover:text-white bg-[#FFF5F5] hover:bg-[#A00000] active:scale-95 border border-[#A00000]/30 hover:border-[#A00000] px-3 py-1 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-2xs cursor-pointer group/btn shrink-0"
                          >
                            <Send size={11} className="group-hover/btn:translate-x-0.5 transition-transform" />
                            <span>Send</span>
                          </button>
                        </div>

                        {isBusy && (
                          <div className="space-y-1.5 animate-slide-up">
                            {assignedTickets.slice(0, 2).map(at => (
                              <div key={at.ticketNo} className="text-xs text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 truncate flex items-center justify-between font-bold shadow-2xs">
                                <span className="font-black text-[#A00000]">{at.ticketNo}</span>
                                <span className="truncate ml-2 text-slate-500 text-[11px]">{at.block || at.department}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quick Dispatch Dropdown */}
                      <div className="pt-3 border-t border-slate-200/80">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAssignWorker(e.target.value, w.name);
                              e.target.value = '';
                            }
                          }}
                          defaultValue=""
                          className="w-full text-xs font-bold bg-white text-slate-800 border border-slate-300/80 hover:border-[#A00000] rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#A00000]/20 transition-all cursor-pointer shadow-2xs"
                        >
                          <option value="" disabled>+ Dispatch Ticket to {w.name.split(' ')[0]}…</option>
                          {pendingUnassigned.length === 0 ? (
                            <option value="" disabled>No Unassigned Complaints</option>
                          ) : (
                            pendingUnassigned.map(t => (
                              <option key={t.ticketNo} value={t.ticketNo}>
                                Dispatch {t.ticketNo} ({t.issueCategory || t.block})
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2-Column Grid: Active Dispatches & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Active Work Order Dispatches Log (Fills lg:col-span-2) */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.04)] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Send size={15} className="text-[#A00000]" /> Active Work Order Dispatches & Staff Allocations
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Real-time tracking of complaints dispatched to maintenance workers.
                    </p>
                  </div>
                  <span className="text-[10px] font-black text-[#A00000] bg-[#FFF5F5] border border-[#A00000]/30 px-3 py-1 rounded-full shrink-0 shadow-2xs">
                    {tickets.filter(t => t.assignedWorker && t.status !== 'Completed').length} Active Dispatches
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {tickets.filter(t => t.assignedWorker && t.status !== 'Completed').length === 0 ? (
                    <div className="py-8 text-center space-y-1.5">
                      <span className="text-3xl animate-float-gentle inline-block">📭</span>
                      <p className="text-xs font-bold text-slate-700">No active work dispatches right now</p>
                      <p className="text-[11px] text-slate-400">Use the dispatch dropdowns in the roster section above to assign complaints.</p>
                    </div>
                  ) : (
                    tickets.filter(t => t.assignedWorker && t.status !== 'Completed').map(t => {
                      const workerObj = dynamicWorkers.find(w => w.name === t.assignedWorker);
                      return (
                        <div key={t.ticketNo} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 rounded-2xl px-3 transition-all duration-200 group">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-xs text-slate-900">{t.ticketNo}</span>
                              <span className="text-[10px] font-bold text-[#111111] bg-[#F5F5F5] px-2.5 py-0.5 rounded-full border border-[#E5E5E5]">
                                👤 {t.assignedWorker}
                              </span>
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                Ongoing
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium truncate mt-0.5">
                              {t.description || t.issueCategory} · <span className="text-slate-400">{t.block || t.department} (Room {t.roomNo || 'N/A'})</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleSolveTicket(t)}
                              className="bg-[#A00000] hover:bg-[#800000] active:scale-95 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-xl transition-all duration-200 shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 size={13} /> Mark Solved
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Recent Activity Log (Fills lg:col-span-1) */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.04)] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={15} className="text-[#A00000] animate-pulse" /> Recent Activity Log
                  </h3>
                </div>
                <div className="space-y-2.5">
                  {activityLog.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No activity logged yet.</p>
                  ) : (
                    activityLog.map(t => (
                      <div key={t.ticketNo} className="flex items-center justify-between text-xs py-2 px-2.5 rounded-xl hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="font-black text-slate-800 shrink-0">{t.ticketNo}</span>
                          <span className="text-slate-600 font-semibold truncate">{t.name}</span>
                        </div>
                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${t.status === 'Completed' ? 'bg-[#FFF5F5] text-[#A00000] border border-[#A00000]/30' : t.status === 'Ongoing' ? 'badge-ongoing' : 'badge-unsolved'
                          }`}>
                          {t.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
              <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                <input
                  type="search"
                  id="admin-search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by Ticket #, Name, Dept, Block, Description…"
                  className="input-field !pl-10 text-sm w-full"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                <div className="flex-1 min-w-[120px] flex items-center gap-1.5 bg-slate-50 px-2.5 rounded-xl border border-slate-200">
                  <SlidersHorizontal size={14} className="text-slate-400 shrink-0" />
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="bg-transparent text-xs py-2 w-full font-bold cursor-pointer outline-none border-none"
                    aria-label="Filter by status"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Unsolved">Unsolved</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="flex-1 min-w-[120px] flex items-center gap-1.5 bg-slate-50 px-2.5 rounded-xl border border-slate-200">
                  <Filter size={14} className="text-slate-400 shrink-0" />
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="bg-transparent text-xs py-2 w-full font-bold cursor-pointer outline-none border-none"
                    aria-label="Filter by user type"
                  >
                    <option value="All">All Types</option>
                    <option value="Student">Student</option>
                    <option value="Staff">Staff</option>
                    <option value="Unit">Unit</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setFilterUrgent(v => !v)}
                  className={`flex items-center justify-center gap-1.5 text-xs font-black px-4 py-2 rounded-xl border transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 shrink-0 ${filterUrgent
                    ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/25 animate-pulse'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-red-400 hover:text-red-500'
                  }`}
              >
                ⚠️ Urgent Only
              </button>

              {(search || filterStatus !== 'All' || filterType !== 'All' || filterUrgent) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setFilterStatus('All');
                    setFilterType('All');
                    setFilterUrgent(false);
                  }}
                  className="text-xs text-slate-500 hover:text-red-600 transition underline font-bold cursor-pointer ml-1"
                >
                  Clear filters
                </button>
              )}
              </div>
            </div>

            {/* Modern Kanban Board */}
            <KanbanBoard
              tickets={[...allUnsolved, ...allOngoing, ...allCompleted]}
              onTicketSelect={setSelectedTicket}
              onSolveTicket={handleSolveTicket}
              onTicketsChange={refreshTickets}
            />
          </>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleTicketUpdate}
          onOpenTimeline={(t) => {
            setSelectedTicket(null);
            setTimelineTicket(t);
          }}
        />
      )}

      {/* Individual Work Order Timeline Modal */}
      {timelineTicket && (
        <WorkTimelineModal
          ticket={timelineTicket}
          onClose={() => setTimelineTicket(null)}
        />
      )}

      {/* Direct Worker Email Modal */}
      {emailingWorker && (
        <WorkerEmailModal
          isOpen={!!emailingWorker}
          worker={emailingWorker}
          tickets={tickets}
          onClose={() => setEmailingWorker(null)}
          onEmailSent={(msg) => showToast(msg)}
        />
      )}
    </div>
  );
}
