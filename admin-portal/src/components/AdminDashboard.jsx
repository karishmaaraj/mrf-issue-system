/**
 * AdminDashboard.jsx — Master Redesigned Admin Portal (Light MCC Theme)
 * Features:
 * 1. LEFT SIDEBAR (Clean white sidebar, MCC FIX HUB branding, active pill)
 * 2. TOP HEADER ("Good morning, Admin! 👋", subtitle, Date/Time, Avatar, Actions)
 * 3. COMPACT STATUS SUMMARY (Unsolved, In Progress, Awaiting, Resolved, Reopened)
 * 4. NEEDS YOUR ATTENTION (Primary action area with [ 🔧 Assign Work ] / [ Review & Reassign ])
 * 5. SEARCH + FILTERS (Positioned before complaint board)
 * 6. COMPLAINT BOARD (4 clean columns: Unsolved, In Progress, Awaiting Confirmation, Resolved)
 * 7. ASSIGN WORK MODAL (Light MCC Maroon theme)
 * 8. WORKER OVERVIEW (Real dynamic worker cards & real workload)
 * 9. RECENT ACTIVITY (Timestamped activity panel)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLogin from './AdminLogin.jsx';
import StatRow from './StatRow.jsx';
import PriorityQueue from './PriorityQueue.jsx';
import WorkerGrid from './WorkerGrid.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import KanbanBoard from './KanbanBoard.jsx';
import TicketDetailModal from './TicketDetailModal.jsx';
import WorkerEmailModal from './WorkerEmailModal.jsx';
import WorkHistoryView from './WorkHistoryView.jsx';
import WorkTimelineModal from './WorkTimelineModal.jsx';
import AssignWorkModal from './AssignWorkModal.jsx';
import CollegeLogo from './CollegeLogo.jsx';
import { getTickets, updateTicket, fetchTicketsFromServer, isTicketUrgent } from '../ticketsStore.js';
import { sendCompletionEmail } from '../emailService.js';
import { getSystemConfig, fetchSystemConfigFromServer } from '../systemConfigStore.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard, ClipboardList, Users, FileText, Bell, Settings,
  LogOut, RefreshCw, Search, SlidersHorizontal, Filter, Shield,
  CheckCircle2, Wrench, Send, FileSpreadsheet, User, Calendar, Menu, X, ChevronRight, Flame
} from 'lucide-react';

import { WORKERS } from '../constants.js';

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');

  const checkSession = useCallback(async () => {
    try {
      const apiBase = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80')
        ? ''
        : 'http://localhost:5000';
      const res = await fetch(`${apiBase}/api/admin/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && ['ADMIN', 'SUPER_ADMIN'].includes(data.user?.role)) {
          setAuthed(true);
          setAdminUser(data.user);
          return;
        }
      }
    } catch (e) {
      console.warn('[Admin Session Check Error]', e);
    }
    setAuthed(false);
    setAdminUser(null);
  }, []);

  useEffect(() => {
    document.title = 'MCC Admin Portal — Maintenance Operations';
    checkSession();
  }, [checkSession]);

  const handleLogout = async () => {
    try {
      const apiBase = typeof window !== 'undefined' && (window.location.port === '' || window.location.port === '80')
        ? ''
        : 'http://localhost:5000';
      await fetch(`${apiBase}/api/admin/logout`, { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.warn('[Admin Logout Error]', e);
    }
    setAuthed(false);
    setAdminUser(null);
  };

  const [tickets, setTickets] = useState(() => getTickets());
  const [systemConfig, setSystemConfig] = useState(() => getSystemConfig());
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [assigningTicket, setAssigningTicket] = useState(null);
  const [timelineTicket, setTimelineTicket] = useState(null);
  const [historyViewMode, setHistoryViewMode] = useState(null);
  const [emailingWorker, setEmailingWorker] = useState(null);
  const [toast, setToast] = useState(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterWorker, setFilterWorker] = useState('All');
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
      ? new BroadcastChannel('mcc_tickets_sync_channel')
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

    showToast(`Work Order ${ticketNo} assigned & dispatched to ${workerName}!`);
  };

  const handleTicketUpdate = (updated) => {
    setTickets(prev =>
      prev.map(t => t.ticketNo === updated.ticketNo ? updated : t)
    );
    setSelectedTicket(updated);
  };

  const handleExportPDF = () => {
    if (!tickets || tickets.length === 0) {
      showToast('No tickets available to export.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeFormatted = now.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });

    const total = tickets.length;
    const unsolved = tickets.filter(t => t.status === 'Unsolved').length;
    const ongoing = tickets.filter(t => t.status === 'Ongoing' || t.status === 'Awaiting User Confirmation' || t.status === 'Reopened').length;
    const completed = tickets.filter(t => t.status === 'Completed' || t.status === 'Resolved').length;

    // Header Banner
    doc.setFillColor(128, 0, 0); // MCC Primary Maroon #800000
    doc.rect(0, 0, 297, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('MCC FIX HUB — Campus Facilities Management Report', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated: ${timeFormatted}`, 283, 12, { align: 'right' });

    // Summary Subheader
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`Report Summary: Total: ${total} | Unsolved: ${unsolved} | In Progress: ${ongoing} | Solved & Closed: ${completed}`, 14, 29);

    const tableHeaders = [[
      'Ticket #',
      'Complainant & Contact',
      'Dept & Class',
      'Category & Location',
      'Priority',
      'Description',
      'Assigned Worker',
      'Status',
      'Date Logged'
    ]];

    const tableRows = tickets.map(t => [
      t.ticketNo || '',
      `${t.name || 'N/A'}\n${t.email || ''}`,
      `${t.department || 'General'}\n[${t.userType || 'Student'}]`,
      `${t.issueCategory || 'General'}\n${t.block || 'Campus'} (Rm ${t.roomNo || 'N/A'})`,
      t.priority || 'Normal',
      t.description || 'No description provided',
      t.assignedWorker || 'Unassigned',
      t.status || 'Unsolved',
      t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : ''
    ]);

    autoTable(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 33,
      theme: 'grid',
      headStyles: {
        fillColor: [128, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [15, 23, 42],
        cellPadding: 2.5,
      },
    });

    const fileName = `MCC_FIX_HUB_Tickets_${dateStr}.pdf`;
    doc.save(fileName);
    showToast(`Exported ${tickets.length} ticket(s) to ${fileName}`);
  };

  const handleExportExcel = () => {
    if (!tickets || tickets.length === 0) {
      showToast('No tickets available to export.');
      return;
    }

    const rows = tickets.map(t => ({
      'Ticket ID': t.ticketNo || '',
      'User Name': t.name || '',
      'Email': t.email || '',
      'Phone': t.phone || '',
      'Department': t.department || '',
      'Location / Block': t.block || '',
      'Room / Area': t.roomNo || '',
      'Issue Category': t.issueCategory || '',
      'Priority': t.priority || 'Normal',
      'Description': t.description || '',
      'Assigned Worker': t.assignedWorker || 'Unassigned',
      'Status': t.status || 'Unsolved',
      'Created Date': t.createdAt || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MCC Tickets');

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `MCC_FIX_HUB_Tickets_${dateStr}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    showToast(`Exported ${tickets.length} ticket(s) to ${fileName}`);
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
      if (filterStatus === 'Completed') {
        filtered = filtered.filter(t => t.status === 'Completed' || t.status === 'Resolved');
      } else if (filterStatus === 'Ongoing') {
        filtered = filtered.filter(t => t.status === 'Ongoing' || t.status === 'Reopened');
      } else if (filterStatus === 'Awaiting') {
        filtered = filtered.filter(t => t.status === 'Awaiting User Confirmation');
      } else {
        filtered = filtered.filter(t => t.status === filterStatus);
      }
    }

    if (filterType !== 'All') {
      filtered = filtered.filter(t => t.issueCategory === filterType || t.userType === filterType);
    }

    if (filterPriority !== 'All') {
      filtered = filtered.filter(t => t.priority === filterPriority);
    }

    if (filterWorker !== 'All') {
      filtered = filtered.filter(t => t.assignedWorker === filterWorker);
    }

    if (filterUrgent) {
      filtered = filtered.filter(t => isTicketUrgent(t));
    }

    return {
      Unsolved: filtered.filter(t => t.status === 'Unsolved'),
      Ongoing: filtered.filter(t => t.status === 'Ongoing' || t.status === 'Awaiting User Confirmation' || t.status === 'Reopened'),
      Completed: filtered.filter(t => t.status === 'Completed' || t.status === 'Resolved'),
    };
  }, [tickets, search, filterStatus, filterType, filterPriority, filterWorker, filterUrgent]);

  const attentionCount = useMemo(() => {
    return tickets.filter(t => {
      if (t.status === 'Completed' || t.status === 'Resolved' || t.status === 'Archived') return false;
      const isUnsolvedUnassigned = t.status === 'Unsolved' && (!t.assignedWorker || !t.assignedWorker.trim());
      const isReopened = t.status === 'Reopened';
      const isUrgent = isTicketUrgent(t);
      return isUnsolvedUnassigned || isReopened || isUrgent;
    }).length;
  }, [tickets]);

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }, []);

  const navItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'Complaints', label: 'All Complaints', icon: ClipboardList },
    { id: 'Workers', label: 'Workers', icon: Users },
    { id: 'Reports', label: 'Reports', icon: FileText },
    { id: 'Notifications', label: 'Notifications', icon: Bell },
    { id: 'Settings', label: 'Settings', icon: Settings },
  ];

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-900 flex flex-row selection:bg-[#800000] selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg border border-slate-800 flex items-center gap-2.5 max-w-md">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span className="leading-snug">{toast}</span>
        </div>
      )}

      {/* 1. LEFT SIDEBAR */}
      <aside className={`
        fixed xl:static top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-200 shadow-xs
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'}
      `}>
        <div className="space-y-6 p-5">
          {/* Brand Section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollegeLogo className="h-10 w-auto shrink-0" />
              <div>
                <p className="font-extrabold text-[#800000] text-base leading-none tracking-tight">
                  MCC FIX HUB
                </p>
                <p className="text-[11px] text-slate-500 font-semibold leading-tight mt-1">
                  Maintenance Operations
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="xl:hidden text-slate-400 hover:text-slate-700"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id === 'Complaints') setHistoryViewMode('TOTAL');
                    if (item.id === 'Workers') setHistoryViewMode(null);
                    if (item.id === 'Reports') handleExportPDF();
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all duration-150 cursor-pointer
                    ${isSelected
                      ? 'bg-[#FFF5F5] text-[#800000] font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold'
                    }
                  `}
                >
                  <Icon size={16} className={isSelected ? 'text-[#800000]' : 'text-slate-400'} />
                  <span>{item.label}</span>
                  {item.id === 'Notifications' && attentionCount > 0 && (
                    <span className="ml-auto bg-[#800000] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {attentionCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 bg-[#F7F9FC]/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#FFF5F5] text-[#800000] border border-[#800000]/20 flex items-center justify-center font-bold text-xs">
                A
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">Admin Account</p>
                <p className="text-[10px] text-slate-500 font-medium truncate">Facilities Admin</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="text-slate-400 hover:text-[#800000] p-1 transition cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs xl:hidden"
        />
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* 2. TOP HEADER */}
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
            {/* Left Greeting */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="xl:hidden text-slate-600 hover:text-slate-900 p-1"
              >
                <Menu size={20} />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Good morning, Admin 👋
                </h1>
                <p className="text-xs text-slate-500 font-medium leading-tight mt-0.5">
                  {attentionCount === 0
                    ? 'All clear! No complaints currently require attention.'
                    : `${attentionCount} complaint${attentionCount === 1 ? '' : 's'} need your attention`}
                </p>
              </div>
            </div>

            {/* Right Controls — Single Horizontal Action Row */}
            <div className="flex items-center justify-end gap-2 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
              {/* 1. Date Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                <Calendar size={14} className="text-[#800000] shrink-0" />
                <span>{currentDateFormatted}</span>
              </div>

              {/* 2. Refresh Button */}
              <button
                type="button"
                onClick={() => refreshTickets(true)}
                disabled={isRefreshing}
                title="Refresh Dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-[#800000] hover:bg-[#FFF5F5] hover:border-[#800000]/30 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <RefreshCw size={14} className={`shrink-0 ${isRefreshing ? 'animate-spin text-[#800000]' : ''}`} />
                <span>Refresh</span>
              </button>

              {/* 3. Export PDF Button */}
              <button
                type="button"
                onClick={handleExportPDF}
                title="Export PDF Report"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-[#800000] hover:bg-[#FFF5F5] hover:border-[#800000]/30 transition-all cursor-pointer shadow-2xs"
              >
                <FileText size={14} className="text-rose-600 shrink-0" />
                <span>PDF</span>
              </button>

              {/* 4. Export Excel Button */}
              <button
                type="button"
                onClick={handleExportExcel}
                title="Export Excel Data"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet size={14} className="text-emerald-600 shrink-0" />
                <span>Excel</span>
              </button>

              {/* 5. Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                title="Logout Admin Session"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer shadow-2xs"
              >
                <LogOut size={14} className="text-slate-500 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 space-y-6">
          {/* 3. COMPACT STATUS SUMMARY */}
          <StatRow
            tickets={tickets}
            activeCategory={historyViewMode}
            onSelectCategory={(cat) => setHistoryViewMode(prev => prev === cat ? null : cat)}
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
            <>
              {/* 4. NEEDS YOUR ATTENTION (Primary Action Area) */}
              <PriorityQueue
                tickets={tickets}
                onSelectTicket={setSelectedTicket}
                onAssignWork={(t) => setAssigningTicket(t)}
                onViewAll={() => setHistoryViewMode('TOTAL')}
              />

              {/* 5. SEARCH + FILTERS + EXPORT CONTROLS */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Filter size={14} className="text-[#800000]" /> Search & Filter Complaints
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    {(search || filterStatus !== 'All' || filterType !== 'All' || filterPriority !== 'All' || filterWorker !== 'All' || filterUrgent) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setFilterStatus('All');
                          setFilterType('All');
                          setFilterPriority('All');
                          setFilterWorker('All');
                          setFilterUrgent(false);
                        }}
                        className="text-xs text-[#800000] font-bold hover:underline cursor-pointer mr-2"
                      >
                        Clear filters
                      </button>
                    )}

                    {/* Export PDF Button */}
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      title="Export PDF Report"
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#800000] hover:bg-[#FFF5F5] px-3 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer shadow-2xs"
                    >
                      <FileText size={14} className="text-[#800000]" />
                      <span>Export PDF</span>
                    </button>

                    {/* Export Excel Button */}
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      title="Export Excel Data"
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#800000] hover:bg-[#FFF5F5] px-3 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer shadow-2xs"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-700" />
                      <span>Export Excel</span>
                    </button>
                  </div>
                </div>


                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                  {/* Search Input */}
                  <div className="sm:col-span-2 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="search"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search by ticket #, name, department, location..."
                      className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-[#F7F9FC] border border-slate-200 text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#800000] transition shadow-2xs"
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="text-xs font-bold bg-[#F7F9FC] border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Unsolved">Unsolved</option>
                    <option value="Ongoing">In Progress</option>
                    <option value="Awaiting">Awaiting Confirmation</option>
                    <option value="Completed">Resolved & Closed</option>
                  </select>

                  {/* Category Filter */}
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="text-xs font-bold bg-[#F7F9FC] border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="All">All Categories</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="IT / Network">IT / Network</option>
                    <option value="Civil / Infra">Civil / Infra</option>
                    <option value="Sanitation">Sanitation</option>
                  </select>

                  {/* Priority Filter */}
                  <select
                    value={filterPriority}
                    onChange={e => setFilterPriority(e.target.value)}
                    className="text-xs font-bold bg-[#F7F9FC] border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="All">All Priorities</option>
                    <option value="Normal">Normal Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Critical">Critical Priority</option>
                  </select>

                  {/* Worker Filter */}
                  <select
                    value={filterWorker}
                    onChange={e => setFilterWorker(e.target.value)}
                    className="text-xs font-bold bg-[#F7F9FC] border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="All">All Workers</option>
                    {dynamicWorkers.map(w => (
                      <option key={w.name} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 6. COMPLAINT BOARD (Kanban) */}
              <div className="space-y-2">
                <KanbanBoard
                  tickets={[...allUnsolved, ...allOngoing, ...allCompleted]}
                  onTicketSelect={setSelectedTicket}
                  onSolveTicket={handleSolveTicket}
                  onAssignWork={(t) => setAssigningTicket(t)}
                  onTicketsChange={refreshTickets}
                />
              </div>

              {/* 7 & 8. WORKER OVERVIEW & RECENT ACTIVITY GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 7. Worker Overview (Fills lg:col-span-2) */}
                <div className="lg:col-span-2">
                  <WorkerGrid
                    workers={dynamicWorkers}
                    tickets={tickets}
                    onAssignWorker={handleAssignWorker}
                    onEmailWorker={setEmailingWorker}
                  />
                </div>

                {/* 8. Recent Activity (Fills lg:col-span-1) */}
                <div className="lg:col-span-1">
                  <ActivityFeed
                    tickets={tickets}
                    onSelectTicket={setSelectedTicket}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* MODALS */}
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

      {timelineTicket && (
        <WorkTimelineModal
          ticket={timelineTicket}
          onClose={() => setTimelineTicket(null)}
        />
      )}

      {emailingWorker && (
        <WorkerEmailModal
          isOpen={!!emailingWorker}
          worker={emailingWorker}
          tickets={tickets}
          onClose={() => setEmailingWorker(null)}
          onEmailSent={(msg) => showToast(msg)}
        />
      )}

      {/* 7. ASSIGN WORK MODAL */}
      {assigningTicket && (
        <AssignWorkModal
          isOpen={!!assigningTicket}
          ticket={assigningTicket}
          workers={dynamicWorkers}
          tickets={tickets}
          onClose={() => setAssigningTicket(null)}
          onAssign={async (tNo, wName) => {
            setAssigningTicket(null);
            await handleAssignWorker(tNo, wName);
          }}
        />
      )}
    </div>
  );
}
