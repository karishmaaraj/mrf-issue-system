/**
 * TicketDetailModal.jsx — Ticket Detail Modal with Rich Micro-Animations
 * Features smooth spring modal scale-in, animated urgent switch, status progress feedback, and photo zoom.
 */
import React, { useState } from 'react';
import { updateTicket } from '../ticketsStore.js';
import { sendCompletionEmail } from '../emailService.js';
import {
  X, User, Mail, Building2, MapPin, FileText, Wrench,
  CheckCircle2, AlertTriangle, ArrowRight, Calendar, Tag, Shield, Sparkles
} from 'lucide-react';

import { WORKER_LIST } from '../constants.js';

const STATUS_FLOW = {
  Unsolved: { next: 'Ongoing',   label: 'Mark as Ongoing',   color: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25', icon: ArrowRight },
  Ongoing:  { next: 'Completed', label: 'Mark as Completed', color: 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/25', icon: CheckCircle2 },
  Completed: null,
};

function DetailRow({ icon: Icon, label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
      <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0 h-fit mt-0.5">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm text-slate-800 mt-0.5 break-words font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function TicketDetailModal({ ticket: initialTicket, onClose, onUpdate, onOpenTimeline }) {
  const [ticket, setTicket]         = useState(initialTicket);
  const [worker, setWorker]         = useState(ticket.assignedWorker || '');
  const [customWorker, setCustomWorker] = useState('');
  const [saving, setSaving]         = useState(false);
  const [emailSent, setEmailSent]   = useState(false);
  const [imgZoomed, setImgZoomed]   = useState(false);

  const effectiveWorker = worker === '__custom__' ? customWorker : worker;

  const handleStatusChange = async (nextStatus) => {
    setSaving(true);
    const updates = { status: nextStatus };
    if (nextStatus === 'Completed') {
      updates.completedAt = new Date().toISOString();
      updates.completedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      updates.completedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      updates.completedBy = ticket.assignedWorker || 'Facilities Admin';
    }
    const updated = await updateTicket(ticket.ticketNo, updates);
    setTicket(updated);
    onUpdate(updated);
    setSaving(false);

    if (nextStatus === 'Completed') {
      await sendCompletionEmail({
        to_email: ticket.email,
        to_name: ticket.name,
        ticket_no: ticket.ticketNo,
      });
      setEmailSent(true);
    }
  };

  const handleAssign = async () => {
    if (!effectiveWorker) return;
    setSaving(true);
    const updated = await updateTicket(ticket.ticketNo, {
      assignedWorker: effectiveWorker,
      status: ticket.status === 'Unsolved' ? 'Ongoing' : ticket.status,
    });
    setTicket(updated);
    onUpdate(updated);
    setSaving(false);
  };

  const handleToggleUrgent = () => {
    const updated = updateTicket(ticket.ticketNo, { isUrgent: !ticket.isUrgent });
    setTicket(updated);
    onUpdate(updated);
  };

  const flow = STATUS_FLOW[ticket.status];

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 animate-fade-in transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div className="animate-scale-in pointer-events-auto bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-lg font-black text-slate-900 tracking-tight">{ticket.ticketNo}</span>
              <span className={`text-xs font-black px-3 py-1 rounded-full shadow-2xs ${
                ticket.status === 'Unsolved'  ? 'badge-unsolved'  :
                ticket.status === 'Ongoing'   ? 'badge-ongoing'   :
                                               'badge-completed'
              }`}>
                {ticket.status}
              </span>
              {(ticket.isUrgent || (ticket.status !== 'Completed' && (Date.now() - new Date(ticket.createdAt).getTime()) > 48 * 36e5)) && (
                <span className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full font-black animate-pulse shadow-2xs">
                  <AlertTriangle size={12} className="animate-bounce" /> Urgent
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onOpenTimeline && (
                <button
                  onClick={() => onOpenTimeline(ticket)}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-black transition cursor-pointer flex items-center gap-1 border border-blue-200/80 shadow-2xs"
                  title="View full lifecycle timeline"
                >
                  <Sparkles size={13} className="text-blue-600" />
                  <span>Timeline</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-2xl hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-all cursor-pointer active:scale-90"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {ticket.photo && (
              <div
                className="rounded-2xl overflow-hidden cursor-zoom-in border border-slate-200 shadow-sm group relative"
                onClick={() => setImgZoomed(true)}
              >
                <img
                  src={ticket.photo}
                  alt="Ticket photo"
                  className="w-full max-h-60 object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5">
                  <span>Click to enlarge photo</span>
                </div>
              </div>
            )}

            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
              <DetailRow icon={User}      label="Name"        value={ticket.name} />
              <DetailRow icon={Mail}      label="Email"       value={ticket.email} mono />
              <DetailRow icon={Building2} label="Department"  value={ticket.department} />
              <DetailRow icon={Tag}       label="User Type"   value={
                ticket.userType +
                (ticket.studentStream ? ` · ${ticket.studentStream}` : '') +
                (ticket.studentLevel  ? ` · ${ticket.studentLevel}`  : '')
              } />
              <DetailRow icon={MapPin}    label="Block & Room" value={`${ticket.block || 'Campus'} (Room ${ticket.roomNo || 'N/A'})`} />
              <DetailRow icon={FileText}  label="Description" value={ticket.description} />
              <DetailRow icon={Wrench}    label="Assigned Worker" value={ticket.assignedWorker} />
              <DetailRow icon={Calendar}  label="Submitted"   value={fmt(ticket.createdAt)} />
              {ticket.status === 'Completed' && (
                <>
                  <DetailRow icon={CheckCircle2} label="Completed Date" value={ticket.completedDate || (ticket.completedAt ? new Date(ticket.completedAt).toLocaleDateString() : fmt(ticket.updatedAt))} />
                  <DetailRow icon={Clock} label="Completed Time" value={ticket.completedTime || (ticket.completedAt ? new Date(ticket.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null)} />
                  <DetailRow icon={User} label="Resolved By" value={ticket.completedBy || ticket.assignedWorker || 'Maintenance Staff'} />
                </>
              )}
              <DetailRow icon={Calendar}  label="Last Updated" value={fmt(ticket.updatedAt)} />
            </div>

            {/* Admin Actions Panel */}
            <div className="bg-blue-50/70 border border-blue-100 rounded-3xl p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                <Shield size={14} className="text-blue-600" /> Admin Action Controls
              </h3>

              <div>
                <label htmlFor="worker-select" className="input-label flex items-center gap-1 font-bold text-slate-600">
                  <Wrench size={13} /> Assign Maintenance Worker
                </label>
                <div className="flex gap-2">
                  <select
                    id="worker-select"
                    value={worker}
                    onChange={(e) => setWorker(e.target.value)}
                    className="input-field flex-1 font-bold cursor-pointer"
                  >
                    <option value="">— Unassigned —</option>
                    {WORKER_LIST.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                    <option value="__custom__">+ Enter custom name…</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveWorker}
                    className="px-4 py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    Save
                  </button>
                </div>

                {worker === '__custom__' && (
                  <input
                    type="text"
                    value={customWorker}
                    onChange={(e) => setCustomWorker(e.target.value)}
                    placeholder="Enter worker name…"
                    className="input-field mt-2 animate-slide-up"
                  />
                )}
              </div>

              {/* Urgent Toggle */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-red-500 animate-bounce" /> Flag as Urgent
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Tickets older than 48h are automatically highlighted.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleUrgent}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shadow-inner ${
                    ticket.isUrgent ? 'bg-red-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                      ticket.isUrgent ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Status Advance Button */}
              {flow ? (
                <button
                  type="button"
                  onClick={handleStatusAdvance}
                  disabled={saving}
                  className={`w-full text-white font-black py-3 rounded-2xl transition-all duration-200
                    flex items-center justify-center gap-2 text-sm shadow-md active:scale-98 cursor-pointer ${flow.color}
                    disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <flow.icon size={16} className="animate-pulse" />
                      {flow.label}
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 text-emerald-700 bg-emerald-100/90 border border-emerald-200 rounded-2xl py-3 text-sm font-black shadow-xs">
                  <CheckCircle2 size={18} className="text-emerald-600 animate-pop-badge" />
                  Issue Resolved & Closed
                </div>
              )}

              {emailSent && (
                <p className="text-xs text-emerald-700 text-center flex items-center justify-center gap-1.5 animate-slide-up font-bold">
                  <CheckCircle2 size={13} />
                  Completion email sent to {ticket.email}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {imgZoomed && ticket.photo && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setImgZoomed(false)}
        >
          <img
            src={ticket.photo}
            alt="Full size"
            className="max-w-full max-h-full rounded-2xl shadow-2xl animate-scale-in"
          />
          <button
            onClick={() => setImgZoomed(false)}
            className="absolute top-6 right-6 bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>
      )}
    </>
  );
}
