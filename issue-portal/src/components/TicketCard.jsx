/**
 * TicketCard.jsx — Clean Modern SaaS Issue Card with Symmetrical Squircle Shape & Micro-Interactions
 * Features balanced 20px squircle geometry, glowing status pill badges, compact thumbnail, and smooth hover lifts.
 */
import React, { useState } from 'react';
import { isTicketUrgent } from '../ticketsStore.js';
import {
  AlertTriangle, User, MapPin, Clock, Wrench, CheckCircle2, Tag, Trash2, Flame
} from 'lucide-react';

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_THEME = {
  Unsolved: {
    border: 'hover:border-red-400/80',
    topBar: 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600',
    badge: 'bg-red-50 text-red-700 border-red-200 shadow-red-500/10',
    dot: 'bg-red-500 animate-pulse',
    glow: 'animate-urgent-glow bg-gradient-to-b from-red-50/25 to-white',
  },
  Ongoing: {
    border: 'hover:border-amber-400/80',
    topBar: 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600',
    badge: 'bg-amber-50 text-amber-800 border-amber-200 shadow-amber-500/10',
    dot: 'bg-amber-500 animate-ping',
    glow: 'animate-ongoing-glow bg-gradient-to-b from-amber-50/20 to-white',
  },
  Completed: {
    border: 'hover:border-emerald-400/80',
    topBar: 'bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-500/10',
    dot: 'bg-emerald-500',
    glow: 'bg-white',
  },
};

export default function TicketCard({ ticket, onSelect, onSolveTicket, provided, snapshot }) {
  const urgent = isTicketUrgent(ticket);
  const isCompleted = ticket.status === 'Completed';
  const isOngoing = ticket.status === 'Ongoing';
  const [solving, setSolving] = useState(false);

  const theme = STATUS_THEME[ticket.status] || STATUS_THEME.Unsolved;

  const handleQuickSolve = async (e) => {
    e.stopPropagation();
    setSolving(true);
    if (onSolveTicket) {
      await onSolveTicket(ticket);
    }
    setTimeout(() => setSolving(false), 500);
  };

  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      onClick={() => onSelect(ticket)}
      className={`
        relative overflow-hidden bg-white rounded-2xl
        border border-slate-200/90 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.04)]
        hover:shadow-xl hover:-translate-y-1.5 ${theme.border}
        transition-all duration-250 p-4.5 group cursor-pointer
        ${snapshot?.isDragging ? 'ticket-card-dragging ring-4 ring-blue-500/40' : ''}
        ${urgent && !isCompleted ? theme.glow : isOngoing ? theme.glow : ''}
      `}
    >
      {/* Interactive Light Shine Sweep */}
      <div className="card-shine-effect" />

      {/* Top Subtle Status Accent Line */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${theme.topBar} transition-all duration-300 group-hover:h-2`} />

      <div className="space-y-3 relative z-10 pt-0.5">
        {/* Header Row: Ticket ID Pill, Status Badge & Timestamp */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Symmetrical Ticket ID Pill */}
            <span className="text-xs font-black text-blue-700 bg-blue-50/90 px-2.5 py-0.5 rounded-lg border border-blue-200/80 tracking-tight shadow-2xs group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-200">
              {ticket.ticketNo}
            </span>

            {/* Glowing Status Pill Badge */}
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-2xs ${theme.badge} transition-all duration-200 flex items-center gap-1.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
              {ticket.status}
            </span>

            {/* Pulsing Urgent Alert */}
            {urgent && !isCompleted && (
              <span className="flex items-center gap-1 text-[9px] font-black text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full animate-pulse shadow-2xs">
                <Flame size={10} className="text-red-600 animate-bounce" /> Urgent
              </span>
            )}
          </div>

          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 shrink-0 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
            <Clock size={10} className="text-slate-400 group-hover:rotate-45 transition-transform duration-300" />
            {timeAgo(ticket.createdAt)}
          </span>
        </div>

        {/* User Info & Photo Thumbnail Row */}
        <div className="flex items-center gap-3">
          {ticket.photo && (
            <div className="w-11 h-11 min-w-[44px] max-w-[44px] h-[44px] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative shadow-2xs ring-1 ring-slate-100 group/photo">
              <img
                src={ticket.photo}
                alt={`Ticket ${ticket.ticketNo}`}
                className="w-full h-full object-cover group-hover/photo:scale-115 transition-transform duration-300"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              <div className="w-4.5 h-4.5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                <User size={10} />
              </div>
              <span className="font-extrabold text-slate-900 truncate">{ticket.name}</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5 pl-6">
              {ticket.department} {ticket.block ? `(${ticket.block})` : ''}
            </p>
          </div>
        </div>

        {/* Description Bubble */}
        <div className="bg-slate-50/80 group-hover:bg-blue-50/30 p-2.5 rounded-xl border border-slate-200/60 transition-colors duration-200">
          <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed font-normal">
            {ticket.description}
          </p>
        </div>

        {/* Footer: Micro Badges & Action Button */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold border border-slate-200/60">
              {ticket.userType}
            </span>
            {ticket.studentStream && (
              <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md font-bold">
                {ticket.studentStream}
              </span>
            )}
            {ticket.assignedWorker && (
              <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-2xs">
                <Wrench size={9} className="animate-spin group-hover-wiggle" /> {ticket.assignedWorker}
              </span>
            )}
          </div>

          {!isCompleted ? (
            <button
              type="button"
              onClick={handleQuickSolve}
              disabled={solving}
              title="Mark ticket as Solved and send email notification to submitter"
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs py-1 px-3 rounded-lg transition-all duration-200 shadow-sm hover:shadow-emerald-500/25 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <CheckCircle2 size={12} className={solving ? 'animate-spin' : ''} />
              <span>{solving ? 'Solving…' : 'Solve'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleQuickSolve}
              title="Click to remove/archive this solved ticket from board"
              className="bg-emerald-50 hover:bg-red-50 text-emerald-700 hover:text-red-600 font-extrabold text-[10px] py-1 px-2.5 rounded-lg border border-emerald-200 hover:border-red-300 transition-all duration-200 shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer group/btn"
            >
              <CheckCircle2 size={11} className="group-hover/btn:hidden text-emerald-600" />
              <Trash2 size={11} className="hidden group-hover/btn:inline text-red-600 animate-bounce" />
              <span className="group-hover/btn:hidden">Solved</span>
              <span className="hidden group-hover/btn:inline">Remove</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
