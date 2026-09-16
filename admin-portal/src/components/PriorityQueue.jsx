/**
 * PriorityQueue.jsx — "Needs Your Attention" Primary Action Section
 * Displays tickets that genuinely require Admin action with strict state-dependent action buttons:
 * - Unsolved + Unassigned: [ 🔧 Assign Work ] (MCC Maroon)
 * - Reopened: [ Review & Reassign ] / [ Review ] (Amber / Purple)
 * - Urgent / Action Required: [ Review ]
 */
import React from 'react';
import { Wrench, ArrowRight, Clock, AlertTriangle, Building2, MapPin, Eye } from 'lucide-react';
import { isTicketUrgent } from '../ticketsStore.js';
import { sortAndFilterAttentionItems } from '../utils/priorityLogic.js';

function timeAgo(isoString) {
  if (!isoString) return 'recently';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function PriorityQueue({ tickets = [], onSelectTicket, onAssignWork, onViewAll }) {
  const uniqueActionItems = sortAndFilterAttentionItems(tickets);
  const actionItems = uniqueActionItems.slice(0, 4);
  const totalAttentionCount = uniqueActionItems.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Needs Your Attention
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {totalAttentionCount} complaint{totalAttentionCount === 1 ? '' : 's'} require immediate action
          </p>
        </div>
        <button
          type="button"
          onClick={() => onViewAll && onViewAll()}
          className="text-xs font-bold text-[#800000] hover:text-[#990000] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>View All</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* List of Attention Items */}
      <div className="divide-y divide-slate-100">
        {actionItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 font-medium">
            🎉 All clear! No complaints currently require immediate Admin action.
          </div>
        ) : (
          actionItems.map((item) => {
            const isUnsolvedUnassigned = item.status === 'Unsolved' && (!item.assignedWorker || !item.assignedWorker.trim());
            const isReopened = item.status === 'Reopened';
            const locationText = [item.block, item.roomNo ? `Room ${item.roomNo}` : null].filter(Boolean).join(' • ') || 'Main Campus';

            return (
              <div
                key={item.ticketNo}
                onClick={() => onSelectTicket && onSelectTicket(item)}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 p-2.5 rounded-xl transition-all duration-150 cursor-pointer group"
              >
                {/* Left Info Column */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-[#800000] bg-[#FFF5F5] px-2 py-0.5 rounded border border-[#800000]/20">
                      {item.ticketNo}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      item.status === 'Unsolved'
                        ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]'
                        : isReopened
                        ? 'bg-[#FAF5FF] text-[#7E22CE] border-[#E9D5FF]'
                        : 'bg-[#FEFCE8] text-[#A16207] border-[#FDE047]'
                    }`}>
                      {isReopened ? 'Reopened' : item.status}
                    </span>
                    {item.priority && (
                      <span className="text-[10px] font-semibold text-slate-500">
                        • {item.priority} Priority
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-bold text-slate-900 group-hover:text-[#800000] transition-colors leading-snug">
                    {item.description || item.issueCategory}
                  </p>

                  <p className="text-xs text-slate-500 font-medium truncate">
                    <span className="font-semibold text-slate-700">{item.issueCategory || 'General'}</span> — {locationText} — <span className="text-slate-400">{timeAgo(item.createdAt)}</span>
                  </p>
                </div>

                {/* Right Action Button Column */}
                <div className="shrink-0 self-end sm:self-center">
                  {isUnsolvedUnassigned ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onAssignWork) onAssignWork(item);
                      }}
                      className="bg-[#800000] hover:bg-[#990000] active:scale-95 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Wrench size={13} />
                      <span>Assign Work</span>
                    </button>
                  ) : isReopened ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectTicket) onSelectTicket(item);
                      }}
                      className="bg-[#FAF5FF] hover:bg-[#F3E8FF] text-[#7E22CE] font-bold text-xs px-3.5 py-1.5 rounded-lg border border-[#E9D5FF] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Review & Reassign</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectTicket) onSelectTicket(item);
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-1.5 rounded-lg border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Review</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

