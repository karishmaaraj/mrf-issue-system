/**
 * TicketCard.jsx — Clean Light Ticket Card (MCC Institutional Theme)
 * Displays ticket details: Ticket #, Priority, Category, Description, Location, Complainant, Worker, Date/Time.
 * Action buttons:
 * - Unsolved & Unassigned ONLY: [ 🔧 Assign Work ] (MCC Maroon)
 * - Assigned / In Progress / Reopened: [ View Details ]
 * - Solved & Closed: [ Solved / Remove ]
 */
import React, { useState } from 'react';
import { isTicketUrgent } from '../ticketsStore.js';
import { User, Clock, Wrench, CheckCircle2, Trash2, Eye, MapPin } from 'lucide-react';

function timeAgo(isoString) {
  if (!isoString) return 'recently';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TicketCard({ ticket, onSelect, onSolveTicket, onAssignWork, provided, snapshot }) {
  const urgent = isTicketUrgent(ticket);
  const isCompleted = ticket.status === 'Completed' || ticket.status === 'Resolved';
  const isOngoing = ticket.status === 'Ongoing' || ticket.status === 'Awaiting User Confirmation' || ticket.status === 'Reopened';
  const isUnsolved = ticket.status === 'Unsolved';
  
  // VERY IMPORTANT: Assign Work button MUST appear ONLY when ticket.status === "Unsolved" AND assignedWorker is empty/null/unassigned
  const canAssignWork = isUnsolved && (!ticket.assignedWorker || !ticket.assignedWorker.trim());
  const [solving, setSolving] = useState(false);

  const handleQuickSolve = async (e) => {
    e.stopPropagation();
    setSolving(true);
    if (onSolveTicket) {
      await onSolveTicket(ticket);
    }
    setTimeout(() => setSolving(false), 500);
  };

  const handleAssignClick = (e) => {
    e.stopPropagation();
    if (onAssignWork) {
      onAssignWork(ticket);
    }
  };

  const locationStr = [ticket.block, ticket.roomNo ? `Room ${ticket.roomNo}` : null].filter(Boolean).join(' • ') || 'Main Campus';

  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      onClick={() => onSelect(ticket)}
      className={`
        bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md
        transition-all duration-200 p-3.5 space-y-3 cursor-pointer group relative overflow-hidden
        ${snapshot?.isDragging ? 'shadow-xl ring-2 ring-[#800000]/40 rotate-1' : ''}
      `}
    >
      {/* Header Row: Ticket ID, Status Badge & Timestamp */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs font-bold text-[#800000] bg-[#FFF5F5] px-2 py-0.5 rounded border border-[#800000]/20">
            {ticket.ticketNo}
          </span>

          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            isUnsolved
              ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]'
              : ticket.status === 'Reopened'
              ? 'bg-[#FAF5FF] text-[#7E22CE] border-[#E9D5FF]'
              : ticket.status === 'Awaiting User Confirmation'
              ? 'bg-[#FEFCE8] text-[#A16207] border-[#FDE047]'
              : isOngoing
              ? 'bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]'
              : 'bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]'
          }`}>
            {ticket.status}
          </span>

          {ticket.priority && (
            <span className="text-[10px] font-semibold text-slate-500">
              • {ticket.priority}
            </span>
          )}
        </div>

        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 shrink-0">
          <Clock size={10} />
          {timeAgo(ticket.createdAt)}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs font-bold text-slate-900 group-hover:text-[#800000] transition-colors leading-snug line-clamp-2">
        {ticket.description || ticket.issueCategory}
      </p>

      {/* Details Row: Complainant & Location */}
      <div className="space-y-1 text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-1.5 truncate">
          <User size={11} className="text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-700 truncate">{ticket.name || 'Anonymous'}</span>
          {ticket.department && <span className="truncate">({ticket.department})</span>}
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <MapPin size={11} className="text-slate-400 shrink-0" />
          <span className="truncate">{locationStr}</span>
        </div>
      </div>

      {/* Footer Row: Worker tag & Action Button */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
          {ticket.issueCategory && (
            <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              {ticket.issueCategory}
            </span>
          )}
          {ticket.assignedWorker && (
            <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded truncate flex items-center gap-1">
              <Wrench size={9} /> {ticket.assignedWorker}
            </span>
          )}
        </div>

        {canAssignWork ? (
          <button
            type="button"
            onClick={handleAssignClick}
            className="bg-[#800000] hover:bg-[#990000] active:scale-95 text-white font-bold text-xs py-1 px-3 rounded-lg transition-all shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Wrench size={12} />
            <span>Assign Work</span>
          </button>
        ) : !isCompleted ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(ticket);
            }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-1 px-2.5 rounded-lg border border-slate-200 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Eye size={12} />
            <span>View Details</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleQuickSolve}
            title="Click to remove/archive solved ticket"
            className="bg-emerald-50 hover:bg-red-50 text-emerald-700 hover:text-red-600 font-extrabold text-[10px] py-1 px-2.5 rounded-lg border border-emerald-200 hover:border-red-300 transition-all shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer group/btn"
          >
            <CheckCircle2 size={11} className="group-hover/btn:hidden text-emerald-600" />
            <Trash2 size={11} className="hidden group-hover/btn:inline text-red-600" />
            <span className="group-hover/btn:hidden">Solved</span>
            <span className="hidden group-hover/btn:inline">Remove</span>
          </button>
        )}
      </div>
    </div>
  );
}

