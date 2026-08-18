/**
 * WorkerEmailModal.jsx — Admin-to-Worker Direct SMTP Email Dispatch Modal
 * Allows the Admin to compose and dispatch instructions directly to any worker's email address via the backend SMTP service.
 * Includes Work Order / Task ID linking for the 1-click "COMPLETED" action button.
 */
import React, { useState, useEffect } from 'react';
import {
  X, Send, Mail, User, Shield, AlertCircle, CheckCircle2,
  Sparkles, Clock, Wrench, MessageSquare, CornerDownRight, Check, FileText
} from 'lucide-react';

const QUICK_TEMPLATES = [
  { label: '⚡ Urgent Inspection', subject: 'Urgent Facility Inspection Required', text: 'Please inspect the reported maintenance issue urgently and report status back to the admin desk.' },
  { label: '📋 Work Order Dispatch', subject: 'Official Work Order Assignment', text: 'You have been assigned a new campus work order. Please review the ticket details and execute repairs.' },
  { label: '🛠️ Parts & Supplies Ready', subject: 'Maintenance Replacement Parts Available', text: 'The requested spare parts and maintenance supplies have arrived at the central inventory office. Please collect them to proceed.' },
  { label: '✅ Task Status Follow-up', subject: 'Follow-up on Assigned Maintenance Task', text: 'Please provide an updated completion timeline for your currently active maintenance tasks.' },
];

export default function WorkerEmailModal({ isOpen, onClose, worker, tickets = [], onEmailSent }) {
  const [subject, setSubject]           = useState('');
  const [message, setMessage]           = useState('');
  const [selectedTicketNo, setSelectedTicketNo] = useState('');
  const [isSending, setIsSending]       = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState(false);

  // Find tickets related to this worker or unassigned
  const workerTickets = (tickets || []).filter(
    t => (t.assignedWorker === worker?.name || !t.assignedWorker) && t.status !== 'Completed'
  );

  // Initialize or reset form when worker changes or modal opens
  useEffect(() => {
    if (worker && isOpen) {
      const activeTicket = (tickets || []).find(
        t => t.assignedWorker === worker.name && t.status !== 'Completed'
      );
      const defaultTicketNo = activeTicket ? activeTicket.ticketNo : (workerTickets[0]?.ticketNo || '');
      setSelectedTicketNo(defaultTicketNo);

      const taskLabel = defaultTicketNo ? ` [${defaultTicketNo}]` : '';
      setSubject(`Facilities Task Dispatch${taskLabel} — ${worker.name}`);
      
      const locText = activeTicket ? `${activeTicket.block || 'Campus'} (Room ${activeTicket.roomNo || 'N/A'})` : 'Campus Facilities';
      const descText = activeTicket?.description ? `\n\nTask Details: ${activeTicket.description}` : '';

      setMessage(`Hello ${worker.name},\n\nPlease review and attend to the campus maintenance task detailed below:\n\nTask Location: ${locText}\nPriority: Standard${descText}\n\nInstructions: Please inspect and proceed with maintenance protocol. When finished on site, tap the COMPLETED button in this email.\n\nRegards,\nCampus Facilities Administrator`);
      setError('');
      setSuccess(false);
      setIsSending(false);
    }
  }, [worker, isOpen]);

  if (!isOpen || !worker) return null;

  const handleApplyTemplate = (tpl) => {
    const taskLabel = selectedTicketNo ? ` [${selectedTicketNo}]` : '';
    setSubject(`${tpl.subject}${taskLabel}`);
    setMessage(`Hello ${worker.name},\n\n${tpl.text}\n\nLinked Task: ${selectedTicketNo || 'General Dispatch'}\nWhen finished, tap the COMPLETED button.\n\nRegards,\nCampus Facilities Administrator`);
  };

  const handleSelectTicket = (tNo) => {
    setSelectedTicketNo(tNo);
    if (tNo) {
      const matched = (tickets || []).find(t => t.ticketNo === tNo);
      if (matched) {
        setSubject(`Facilities Task Dispatch [${tNo}] — ${worker.name}`);
        setMessage(`Hello ${worker.name},\n\nYou have been assigned Work Order ${tNo} (${matched.issueCategory || 'Maintenance'}).\n\nLocation: ${matched.block || 'Campus'} (Room ${matched.roomNo || 'N/A'})\nDescription: ${matched.description || 'Please inspect and complete the required repairs.'}\n\nWhen complete, tap the COMPLETED button in this email.\n\nRegards,\nCampus Facilities Administrator`);
      }
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!worker.email) {
      setError('Worker does not have a valid email address.');
      return;
    }
    if (!subject.trim()) {
      setError('Please provide an email subject.');
      return;
    }
    if (!message.trim()) {
      setError('Please enter a message for the worker.');
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/send-worker-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to_email: worker.email,
          to_name: worker.name,
          ticket_no: selectedTicketNo,
          subject: subject.trim(),
          message: message.trim(),
          sender_name: 'Campus Facilities Administrator',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch email via SMTP server.');
      }

      setSuccess(true);
      if (onEmailSent) {
        onEmailSent(`Email with COMPLETED button sent to ${worker.name} (${worker.email})`);
      }

      // Close modal after brief success feedback
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error('[Worker Email Modal Error]', err);
      setError(err.message || 'Network error: could not connect to local SMTP backend server (port 5000).');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            disabled={isSending}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0 border border-white/20">
              {worker.icon || worker.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                  Email {worker.name}
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/40">
                  {worker.role}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono flex items-center gap-1.5 mt-1">
                <Mail size={12} className="text-cyan-300" />
                <span>{worker.email}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSend} className="p-5 sm:p-6 space-y-4">
          
          {/* Link to Work Order / Task ID */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1"><FileText size={12} className="text-blue-600" /> Linked Work / Task ID:</span>
              <span className="text-[10px] text-emerald-600 font-bold">Generates 1-Click "COMPLETED" Button</span>
            </label>
            <select
              value={selectedTicketNo}
              onChange={(e) => handleSelectTicket(e.target.value)}
              disabled={isSending}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition cursor-pointer"
            >
              <option value="">-- General Message (No Task ID Linked) --</option>
              {workerTickets.map(t => (
                <option key={t.ticketNo} value={t.ticketNo}>
                  {t.ticketNo} — {t.issueCategory} ({t.block || 'Campus'} - Room {t.roomNo || 'N/A'})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Preset Templates */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Sparkles size={11} className="text-indigo-500" /> Quick Message Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleApplyTemplate(tpl)}
                  className="text-[11px] font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Urgent Maintenance Task in Science Block"
              disabled={isSending}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
              required
            />
          </div>

          {/* Message Body Field */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Message</span>
              <span className="text-[10px] font-normal text-slate-400 font-mono">{message.length} chars</span>
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter direct instructions or task updates for this worker..."
              disabled={isSending}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition resize-none"
              required
            />
          </div>

          {/* Feedback Banners */}
          {error && (
            <div className="flex items-center gap-2 text-red-700 text-xs bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 font-bold animate-slide-up">
              <AlertCircle size={15} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-emerald-800 text-xs bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 font-black animate-slide-up">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>Email with COMPLETED action button sent successfully!</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
              <Shield size={11} className="text-emerald-500" /> Secure Token SMTP Dispatch
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSending || success}
                className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md shadow-blue-500/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : success ? (
                  <>
                    <Check size={14} />
                    <span>Sent!</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Send Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
