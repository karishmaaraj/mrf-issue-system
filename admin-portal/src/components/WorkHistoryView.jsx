/**
 * WorkHistoryView.jsx — Full-Page Interactive Work & Complaint History View
 * Backed directly by the live database (tickets.json).
 * Supports 4 filtered view modes: TOTAL, PENDING, URGENT, COMPLETED.
 * Includes search, multi-filter, sorting, card/table view toggles, and individual timeline triggers.
 */
import React, { useState, useMemo } from 'react';
import {
  ArrowLeft, Search, Filter, SlidersHorizontal, Calendar, Clock,
  CheckCircle2, AlertTriangle, ClipboardList, Wrench, User,
  Building2, MapPin, Tag, ChevronRight, Sparkles, Shield,
  ArrowUpDown, Eye, Check, ExternalLink, RefreshCw, LayoutGrid, List
} from 'lucide-react';
import { isTicketUrgent } from '../ticketsStore.js';

export default function WorkHistoryView({
  tickets = [],
  initialCategory = 'TOTAL',
  onBackToDashboard,
  onOpenTimeline,
  onRefresh
}) {
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchTerm, setSearchTerm]         = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStatus, setFilterStatus]     = useState('All');
  const [sortBy, setSortBy]                 = useState('newest'); // newest | oldest | priority
  const [viewLayout, setViewLayout]         = useState('grid'); // grid | table

  // Dynamic counts calculated directly from real database records
  const totalCount     = tickets.length;
  const unsolvedCount  = tickets.filter(t => t.status === 'Unsolved').length;
  const ongoingCount   = tickets.filter(t => t.status === 'Ongoing').length;
  const pendingCount   = unsolvedCount + ongoingCount;
  const urgentCount    = tickets.filter(isTicketUrgent).length;
  const completedCount = tickets.filter(t => t.status === 'Completed').length;

  // Filter tickets by the active main card category
  const baseFilteredTickets = useMemo(() => {
    switch (activeCategory) {
      case 'PENDING':
        return tickets.filter(t => t.status === 'Unsolved' || t.status === 'Ongoing');
      case 'URGENT':
        return tickets.filter(isTicketUrgent);
      case 'COMPLETED':
        return tickets.filter(t => t.status === 'Completed');
      case 'TOTAL':
      default:
        return tickets;
    }
  }, [tickets, activeCategory]);

  // Apply search, secondary filters, and sorting
  const displayedTickets = useMemo(() => {
    return baseFilteredTickets.filter(t => {
      // Search matching
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchNo       = (t.ticketNo || '').toLowerCase().includes(query);
        const matchName     = (t.name || '').toLowerCase().includes(query);
        const matchWorker   = (t.assignedWorker || '').toLowerCase().includes(query);
        const matchCategory = (t.issueCategory || '').toLowerCase().includes(query);
        const matchBlock    = (t.block || '').toLowerCase().includes(query);
        const matchRoom     = (t.roomNo || '').toLowerCase().includes(query);
        const matchDesc     = (t.description || '').toLowerCase().includes(query);
        if (!matchNo && !matchName && !matchWorker && !matchCategory && !matchBlock && !matchRoom && !matchDesc) {
          return false;
        }
      }

      // Secondary Status Filter
      if (filterStatus !== 'All' && t.status !== filterStatus) {
        return false;
      }

      // Priority Filter
      if (filterPriority !== 'All') {
        if (filterPriority === 'Urgent' && !isTicketUrgent(t)) return false;
        if (filterPriority !== 'Urgent' && t.priority !== filterPriority) return false;
      }

      // Category Filter
      if (filterCategory !== 'All' && !t.issueCategory?.includes(filterCategory)) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      if (sortBy === 'priority') {
        const priorityWeight = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Normal': 2, 'Low': 1 };
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      }
      return 0;
    });
  }, [baseFilteredTickets, searchTerm, filterStatus, filterPriority, filterCategory, sortBy]);

  // Dynamic View Titles and Subtitles
  const getHeaderInfo = () => {
    switch (activeCategory) {
      case 'PENDING':
        return {
          title: 'Pending Work Orders',
          subtitle: 'Active facilities maintenance tasks currently ongoing or awaiting worker assignment.',
          icon: Clock,
          color: 'from-amber-500 to-orange-600',
          badge: `${pendingCount} In Progress / Unsolved`,
        };
      case 'URGENT':
        return {
          title: 'Urgent Issues History',
          subtitle: 'Critical and high-priority maintenance emergencies requiring immediate attention.',
          icon: AlertTriangle,
          color: 'from-red-500 to-rose-600',
          badge: `${urgentCount} High Priority`,
        };
      case 'COMPLETED':
        return {
          title: 'Completed Work History',
          subtitle: 'Historical archive of resolved work orders verified by worker 1-click email action.',
          icon: CheckCircle2,
          color: 'from-emerald-500 to-teal-600',
          badge: `${completedCount} Successfully Closed`,
        };
      case 'TOTAL':
      default:
        return {
          title: 'Total Work & Complaint History',
          subtitle: 'Complete database record of all campus complaints, dispatched tasks, and resolutions.',
          icon: ClipboardList,
          color: 'from-blue-600 to-indigo-600',
          badge: `${totalCount} Total Database Records`,
        };
    }
  };

  const header = getHeaderInfo();
  const HeaderIcon = header.icon;

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Navigation & View Title Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 relative overflow-hidden">
        {/* Subtle background gradient shimmer */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-extrabold text-xs transition mb-3 cursor-pointer shadow-2xs group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Control Board</span>
            </button>

            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${header.color} text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0`}>
                <HeaderIcon size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {header.title}
                  </h1>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                    {header.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {header.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Category Switcher Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 self-start md:self-auto">
            <button
              onClick={() => setActiveCategory('TOTAL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'TOTAL'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <ClipboardList size={13} />
              <span>Total</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${activeCategory === 'TOTAL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {totalCount}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('PENDING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Clock size={13} />
              <span>Pending</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${activeCategory === 'PENDING' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {pendingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('URGENT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'URGENT'
                  ? 'bg-red-600 text-white shadow-sm shadow-red-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <AlertTriangle size={13} />
              <span>Urgent</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${activeCategory === 'URGENT' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {urgentCount}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('COMPLETED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'COMPLETED'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <CheckCircle2 size={13} />
              <span>Completed</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${activeCategory === 'COMPLETED' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {completedCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Sorting & View Toggle */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ticket #, user name, worker, block, category, or keyword..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-100 transition"
          >
            <option value="All">All Priorities</option>
            <option value="Critical">🔴 Critical Priority</option>
            <option value="High">🟠 High Priority</option>
            <option value="Normal">🟡 Normal</option>
            <option value="Low">🟢 Low</option>
          </select>

          {/* Status Filter (when in Total or Urgent) */}
          {activeCategory !== 'PENDING' && activeCategory !== 'COMPLETED' && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-100 transition"
            >
              <option value="All">All Statuses</option>
              <option value="Unsolved">Unsolved</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
            </select>
          )}

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-100 transition"
          >
            <option value="newest">📅 Newest First</option>
            <option value="oldest">📅 Oldest First</option>
            <option value="priority">⚡ Highest Priority</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewLayout === 'grid' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-400 hover:text-slate-700'}`}
              title="Card Grid View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewLayout('table')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewLayout === 'table' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-400 hover:text-slate-700'}`}
              title="Detailed Table View"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Results Container */}
      {displayedTickets.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <Search size={24} />
          </div>
          <h3 className="text-base font-black text-slate-800">
            {activeCategory === 'COMPLETED'
              ? 'No completed work found.'
              : activeCategory === 'PENDING'
              ? 'No pending work found.'
              : activeCategory === 'URGENT'
              ? 'No urgent issues found.'
              : 'No work records matching your criteria.'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchTerm || filterPriority !== 'All' || filterStatus !== 'All'
              ? 'Try adjusting your search terms or filter selections to view available maintenance records.'
              : 'All records in the system are currently synchronized and up to date.'}
          </p>
          {(searchTerm || filterPriority !== 'All' || filterStatus !== 'All') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterPriority('All');
                setFilterStatus('All');
              }}
              className="inline-block mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewLayout === 'grid' ? (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedTickets.map(ticket => {
            const isCompleted = ticket.status === 'Completed';
            const isUrgent = isTicketUrgent(ticket);

            return (
              <div
                key={ticket.ticketNo}
                onClick={() => onOpenTimeline && onOpenTimeline(ticket)}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-blue-400 hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col justify-between relative overflow-hidden"
              >
                {/* Top header row */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/80">
                        {ticket.ticketNo}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : ticket.status === 'Ongoing'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>

                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      isUrgent
                        ? 'bg-red-100 text-red-700 font-extrabold animate-pulse'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {ticket.priority || 'Normal'}
                    </span>
                  </div>

                  {/* Issue Category & Location */}
                  <h4 className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">
                    {ticket.issueCategory}
                  </h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium mb-3">
                    <MapPin size={12} className="text-slate-400 shrink-0" />
                    <span>{ticket.block || 'Campus'} (Room {ticket.roomNo || 'N/A'})</span>
                  </p>

                  {/* Task Description Snippet */}
                  {ticket.description && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2 mb-3 font-normal leading-relaxed">
                      {ticket.description}
                    </p>
                  )}
                </div>

                {/* Bottom Meta & Worker Info */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1">
                      <User size={11} className="text-slate-400" />
                      <strong className="text-slate-700">{ticket.name || 'Anonymous'}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <Calendar size={11} className="text-slate-400" />
                      {formatDate(ticket.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="flex items-center gap-1 text-slate-600">
                      <Wrench size={11} className="text-blue-500" />
                      <span className="truncate max-w-[130px]">
                        {ticket.assignedWorker || <span className="text-slate-400 italic">Unassigned</span>}
                      </span>
                    </span>

                    {isCompleted ? (
                      <span className="text-emerald-700 font-extrabold text-[11px] flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        <span>{ticket.completedDate || 'Solved'}</span>
                      </span>
                    ) : (
                      <span className="text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
                        <span>Timeline</span>
                        <ChevronRight size={12} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed Table View */
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Work / Ticket ID</th>
                  <th className="py-3.5 px-4">Complainant</th>
                  <th className="py-3.5 px-4">Issue & Location</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Assigned Worker</th>
                  <th className="py-3.5 px-4">Current Status</th>
                  <th className="py-3.5 px-4">{activeCategory === 'COMPLETED' ? 'Completed Time' : 'Logged Date'}</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedTickets.map(ticket => {
                  const isCompleted = ticket.status === 'Completed';
                  const isUrgent = isTicketUrgent(ticket);

                  return (
                    <tr
                      key={ticket.ticketNo}
                      onClick={() => onOpenTimeline && onOpenTimeline(ticket)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-black text-slate-900">
                        {ticket.ticketNo}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{ticket.name || 'Anonymous'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{ticket.department || ticket.email || 'Campus User'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900">{ticket.issueCategory}</div>
                        <div className="text-[10px] text-slate-500">{ticket.block || 'Campus'} (Room {ticket.roomNo || 'N/A'})</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          isUrgent
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {ticket.priority || 'Normal'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {ticket.assignedWorker ? (
                          <span className="flex items-center gap-1 text-slate-900">
                            <Wrench size={11} className="text-blue-500" />
                            {ticket.assignedWorker}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-normal">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : ticket.status === 'Ongoing'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {isCompleted && ticket.completedDate
                          ? `${ticket.completedDate} ${ticket.completedTime || ''}`
                          : formatDate(ticket.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenTimeline && onOpenTimeline(ticket);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-700 font-extrabold text-[11px] transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye size={12} />
                          <span>Timeline</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
