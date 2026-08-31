/**
 * TicketDetailModal.jsx — Ticket Detail Modal with Rich Micro-Animations
 * Features smooth spring modal scale-in, animated urgent switch, status progress feedback, and photo zoom.
 */
import React, { useState } from 'react';
import { updateTicket, adminOverrideTicket } from '../ticketsStore.js';
import { sendCompletionEmail } from '../emailService.js';
import {
  X, User, Mail, Building2, MapPin, FileText, Wrench,
  CheckCircle2, AlertTriangle, ArrowRight, Calendar, Tag, Shield, Sparkles
} from 'lucide-react';

import { WORKER_LIST } from '../constants.js';

const STATUS_FLOW = {
  Unsolved: { next: 'Ongoing',   label: 'Mark as Ongoing',   color: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25', icon: ArrowRight },
  Ongoing:  { next: 'Awaiting User Confirmation', label: 'Mark Work Completed', color: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 shadow-sky-500/25', icon: CheckCircle2 },
  'Awaiting User Confirmation': null,
  Resolved: null,
  Completed: null,
  Reopened: { next: 'Ongoing', label: 'Reassign & Set Ongoing', color: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/25', icon: Wrench },
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
  const [overrideReason, setOverrideReason] = useState('');

  const effectiveWorker = worker === '__custom__' ? customWorker : worker;

  const handleStatusChange = async (nextStatus) => {
    setSaving(true);
    const updates = { status: nextStatus };
    if (nextStatus === 'Awaiting User Confirmation') {
      updates.workerCompletedAt = new Date().toISOString();
      updates.completedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      updates.completedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      updates.completedBy = ticket.assignedWorker || 'Facilities Admin';
    }
    const updated = await updateTicket(ticket.ticketNo, updates);
    setTicket(updated);
    if (onUpdate) onUpdate(updated);
    setSaving(false);
  };

  const handleAdminOverride = async () => {
    if (!overrideReason.trim()) return;
    setSaving(true);
    const updated = await adminOverrideTicket(ticket.ticketNo, 'Campus Facilities Admin', overrideReason.trim());
    setTicket(updated);
    if (onUpdate) onUpdate(updated);
    setSaving(false);
    setOverrideReason('');
  };

  const handleAssign = async () => {
    if (!effectiveWorker) return;
    setSaving(true);
    const updated = await updateTicket(ticket.ticketNo, {
      assignedWorker: effectiveWorker,
      status: (ticket.status === 'Unsolved' || ticket.status === 'Reopened') ? 'Ongoing' : ticket.status,
    });
    setTicket(updated);
    if (onUpdate) onUpdate(updated);
    setSaving(false);
  };

  const handleToggleUrgent = () => {
    const updated = updateTicket(ticket.ticketNo, { isUrgent: !ticket.isUrgent });
    setTicket(updated);
    if (onUpdate) onUpdate(updated);
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
                ticket.status === 'Awaiting User Confirmation' ? 'bg-sky-100 text-sky-800 border border-sky-300' :
                ticket.status === 'Reopened'  ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                                               'badge-completed'
              }`}>
                {ticket.status}
              </span>
              {(ticket.isUrgent || (ticket.status !== 'Resolved' && ticket.status !== 'Completed' && (Date.now() - new Date(ticket.createdAt).getTime()) > 48 * 36e5)) && (
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

            {ticket.status === 'Reopened' && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-1 text-purple-900">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-purple-800">
                  <AlertTriangle size={14} className="text-purple-600 animate-bounce" /> User Reported Issue Not Fixed
                </div>
                <p className="text-xs text-purple-900 font-bold mt-1">
                  Rejection Reason: <span className="font-medium underline italic">"{ticket.rejectionReason || 'No details provided'}"</span>
                </p>
              </div>
            )}

            {ticket.whatsappDeliveryStatus === 'UNDELIVERED_INVALID_PHONE' && ticket.status === 'Awaiting User Confirmation' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-1 text-amber-900">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-800">
                  <AlertTriangle size={14} className="text-amber-600" /> WhatsApp Verification Undelivered
                </div>
                <p className="text-xs text-amber-800 font-medium">
                  Complainant phone number ({ticket.phone || 'N/A'}) was missing or invalid for WhatsApp. Ticket remains in Awaiting User Confirmation until confirmed or Admin Override applied below.
                </p>
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
              {(ticket.status === 'Resolved' || ticket.status === 'Completed') && (
                <>
                  <DetailRow icon={CheckCircle2} label="Completed Date" value={ticket.completedDate || (ticket.completedAt ? new Date(ticket.completedAt).toLocaleDateString() : fmt(ticket.updatedAt))} />
                  <DetailRow icon={Clock} label="Completed Time" value={ticket.completedTime || (ticket.completedAt ? new Date(ticket.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null)} />
                  <DetailRow icon={User} label="Resolved By" value={ticket.completedBy || ticket.assignedWorker || 'Maintenance Staff'} />
                </>
              )}
              {ticket.adminOverrideReason && (
                <DetailRow icon={Shield} label="Admin Override Reason" value={`"${ticket.adminOverrideReason}" by ${ticket.adminOverrideBy || 'Admin'}`} />
              )}
              {ticket.customFields && Object.keys(ticket.customFields).length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 px-2">Additional Configured Form Fields</p>
                  {Object.entries(ticket.customFields).map(([k, v]) => {
                    if (['name', 'email', 'phone', 'userType', 'studentStream', 'studentLevel', 'department', 'block', 'roomNo', 'issueCategory', 'description', 'priority', 'photo', 'photoName'].includes(k)) return null;
                    if (v === undefined || v === null || v === '') return null;
                    const formattedKey = k.replace(/^sec_|^field_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <DetailRow key={k} icon={Sparkles} label={formattedKey} value={Array.isArray(v) ? v.join(', ') : v.toString()} />
                    );
                  })}
                </div>
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
                    onClick={handleAssign}
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

              {/* Admin Override Section for Awaiting User Confirmation & Reopened */}
              {(ticket.status === 'Awaiting User Confirmation' || ticket.status === 'Reopened') && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield size={14} className="text-amber-700" /> Explicit Admin Override
                    </h4>
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">Manual Resolution</span>
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Enter a mandatory reason below to manually set status to <strong className="font-black text-amber-950">Resolved</strong>:
                  </p>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. User confirmed fixed in person at Facilities Desk..."
                    className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAdminOverride}
                    disabled={saving || !overrideReason.trim()}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Apply Admin Override (Resolve Ticket)'}
                  </button>
                </div>
              )}

              {/* Status Advance Button */}
              {flow && (
                <button
                  type="button"
                  onClick={() => handleStatusChange(flow.next)}
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

