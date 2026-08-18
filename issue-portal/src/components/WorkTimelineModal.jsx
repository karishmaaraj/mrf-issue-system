/**
 * WorkTimelineModal.jsx — Individual Work Order Lifecycle & Event Timeline Modal
 * Illustrates the complete chronological lifecycle of a complaint from submission to resolution:
 * Complaint Raised -> Worker Assigned -> Email Dispatched -> Worker Clicked COMPLETED -> Task Completed & Closed
 */
import React from 'react';
import {
  X, CheckCircle2, Clock, Wrench, Send, AlertTriangle,
  User, Mail, Phone, Building2, MapPin, Tag, Calendar,
  Shield, ExternalLink, ArrowRight, Sparkles, Check
} from 'lucide-react';

function formatDateTime(isoString) {
  if (!isoString) return 'Pending / Not Recorded';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

function getEventIcon(type) {
  switch (type) {
    case 'CREATED':
      return { icon: Tag, color: 'bg-blue-600 text-white shadow-blue-500/30' };
    case 'ASSIGNED':
      return { icon: Wrench, color: 'bg-indigo-600 text-white shadow-indigo-500/30' };
    case 'DISPATCHED':
      return { icon: Send, color: 'bg-cyan-600 text-white shadow-cyan-500/30' };
    case 'WORKER_COMPLETED':
      return { icon: CheckCircle2, color: 'bg-emerald-600 text-white shadow-emerald-500/30' };
    case 'SOLVED':
      return { icon: Shield, color: 'bg-teal-600 text-white shadow-teal-500/30' };
    default:
      return { icon: Clock, color: 'bg-slate-700 text-white shadow-slate-500/30' };
  }
}

export default function WorkTimelineModal({ ticket, onClose }) {
  if (!ticket) return null;

  // Build or sanitize history list
  let historyEvents = Array.isArray(ticket.history) && ticket.history.length > 0
    ? [...ticket.history]
    : [];

  if (historyEvents.length === 0) {
    historyEvents.push({
      id: 'h-1',
      type: 'CREATED',
      title: 'Complaint Raised',
      timestamp: ticket.createdAt,
      actor: ticket.name || 'Complainant',
      details: `Complaint submitted for ${ticket.issueCategory} at ${ticket.block || 'Campus'} (Room ${ticket.roomNo || 'N/A'}).`
    });

    if (ticket.assignedWorker) {
      historyEvents.push({
        id: 'h-2',
        type: 'ASSIGNED',
        title: `Assigned to ${ticket.assignedWorker}`,
        timestamp: ticket.updatedAt || ticket.createdAt,
        actor: 'Campus Facilities Admin',
        details: `Work order dispatched to ${ticket.assignedWorker}.`
      });
    }

    if (ticket.status === 'Completed' || ticket.completedAt) {
      historyEvents.push({
        id: 'h-3',
        type: 'WORKER_COMPLETED',
        title: `Worker Clicked "COMPLETED"`,
        timestamp: ticket.completedAt || ticket.updatedAt,
        actor: ticket.completedBy || ticket.assignedWorker || 'Worker',
        details: `Worker confirmed completion of maintenance on site via 1-click email action.`
      });

      historyEvents.push({
        id: 'h-4',
        type: 'SOLVED',
        title: 'Task Completed & Closed',
        timestamp: ticket.completedAt || ticket.updatedAt,
        actor: 'Central Facilities System',
        details: `Verified resolution. Completed on ${ticket.completedDate || ''} at ${ticket.completedTime || ''}.`
      });
    }
  }

  // Sort events chronologically
  historyEvents.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  const isCompleted = ticket.status === 'Completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-6 relative flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-blue-300 font-black text-lg">
              {ticket.ticketNo}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  Work Order Lifecycle & Timeline
                </h2>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  isCompleted
                    ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/40'
                    : ticket.status === 'Ongoing'
                    ? 'bg-amber-500/30 text-amber-300 border-amber-400/40'
                    : 'bg-blue-500/30 text-blue-300 border-blue-400/40'
                }`}>
                  {ticket.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                {ticket.issueCategory} • {ticket.block || 'Campus'} (Room ${ticket.roomNo || 'N/A'})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          
          {/* Quick Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Complainant</span>
              <p className="text-xs font-black text-slate-800 truncate mt-0.5">{ticket.name || 'Anonymous'}</p>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Assigned Worker</span>
              <p className="text-xs font-black text-slate-800 truncate mt-0.5">{ticket.assignedWorker || 'Unassigned'}</p>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Priority</span>
              <p className={`text-xs font-black truncate mt-0.5 ${ticket.isUrgent || ticket.priority === 'Critical' ? 'text-red-600' : 'text-slate-800'}`}>
                {ticket.priority || 'Normal'}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Completed Date</span>
              <p className="text-xs font-black text-emerald-600 truncate mt-0.5">
                {ticket.completedDate ? `${ticket.completedDate}` : (isCompleted ? 'Completed' : 'Pending')}
              </p>
            </div>
          </div>

          {/* Description Card */}
          {ticket.description && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 block mb-1">
                Task / Issue Description:
              </span>
              <p className="text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                {ticket.description}
              </p>
            </div>
          )}

          {/* Chronological Event Timeline */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-600" /> Complete Chronological Timeline
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                {historyEvents.length} Event{historyEvents.length !== 1 ? 's' : ''} Recorded
              </span>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-indigo-500 before:to-emerald-500">
              {historyEvents.map((evt, idx) => {
                const isLast = idx === historyEvents.length - 1;
                const { icon: EventIcon, color } = getEventIcon(evt.type);

                return (
                  <div key={evt.id || idx} className="relative group">
                    {/* Node Icon on Timeline line */}
                    <div className={`absolute -left-[30px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center ${color} ring-4 ring-white`}>
                      <EventIcon size={12} />
                    </div>

                    {/* Timeline Event Card */}
                    <div className="bg-white hover:bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 transition shadow-xs group-hover:shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                        <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <span>{evt.title}</span>
                          {evt.actor && (
                            <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                              by {evt.actor}
                            </span>
                          )}
                        </h4>
                        <time className="text-[11px] font-bold text-slate-400 font-mono">
                          {formatDateTime(evt.timestamp)}
                        </time>
                      </div>

                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {evt.details}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <Shield size={12} className="text-emerald-500" /> Database Synced & Verified
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
          >
            Close Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
