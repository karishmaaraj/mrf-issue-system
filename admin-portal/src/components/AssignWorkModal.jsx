/**
 * AssignWorkModal.jsx — Assign Work Order Modal (Light MCC Theme)
 * Displays ticket details, What Needs To Be Done, Location, Category, Priority,
 * real dynamic worker availability, and active workload counts.
 * Primary action button: MCC Maroon (#800000). Secondary button: White with border.
 */
import React, { useState } from 'react';
import {
  X, Wrench, MapPin, Building2, FileText, Tag, UserCheck, Flame
} from 'lucide-react';

export default function AssignWorkModal({ isOpen, ticket, workers = [], tickets = [], onClose, onAssign }) {
  const [selectedWorkerName, setSelectedWorkerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !ticket) return null;

  // Calculate active workload per worker from real ticket data
  const getWorkerWorkload = (workerName) => {
    return (tickets || []).filter(
      t => t.assignedWorker === workerName &&
           t.status !== 'Completed' &&
           t.status !== 'Resolved' &&
           t.status !== 'Archived'
    ).length;
  };

  const handleAssignSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedWorkerName || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAssign(ticket.ticketNo, selectedWorkerName);
    } catch (err) {
      console.error('[AssignWorkModal Error]', err);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-xl my-8 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#800000] text-white px-6 py-4 flex items-center justify-between border-b border-[#660000]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0">
              <Wrench size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">Assign Work Order</h2>
                <span className="text-xs font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded">
                  {ticket.ticketNo}
                </span>
              </div>
              <p className="text-xs text-white/80 font-normal mt-0.5">
                Dispatch work order to campus maintenance staff
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-130px)] text-slate-800">
          {/* Section 1: Ticket Details */}
          <div className="bg-[#F7F9FC] rounded-xl border border-slate-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FileText size={14} className="text-[#800000]" /> Ticket Summary
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]">
                {ticket.priority || 'Normal'} Priority
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Description */}
              <div className="sm:col-span-2 bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Complaint Description</p>
                <p className="text-slate-900 font-medium leading-relaxed">{ticket.description || 'No description provided.'}</p>
              </div>

              {/* What Needs To Be Done */}
              <div className="sm:col-span-2 bg-[#FFF7ED] p-3 rounded-lg border border-[#FDBA74]/60 space-y-1">
                <p className="text-[10px] font-bold text-[#C2410C] uppercase tracking-wider flex items-center gap-1">
                  <Wrench size={11} /> What Needs To Be Done?
                </p>
                <p className="text-slate-900 font-semibold leading-relaxed">
                  Inspect and repair <strong className="text-[#9A3412] font-black">{ticket.issueCategory || 'General Maintenance'}</strong> complaint: "{ticket.description || 'General maintenance required'}"
                </p>
              </div>

              {/* Location */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Building2 size={11} /> Location / Block
                </p>
                <p className="text-slate-900 font-bold">{ticket.block || 'Main Campus'}</p>
              </div>

              {/* Room */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin size={11} /> Room / Area
                </p>
                <p className="text-slate-900 font-bold">{ticket.roomNo ? `Room ${ticket.roomNo}` : 'Not Specified'}</p>
              </div>

              {/* Category */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag size={11} /> Issue Category
                </p>
                <p className="text-slate-900 font-bold">{ticket.issueCategory || 'General'}</p>
              </div>

              {/* Complainant */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Complainant</p>
                <p className="text-slate-900 font-bold truncate">{ticket.name || 'Anonymous'} <span className="text-slate-500 font-normal">({ticket.department || 'General'})</span></p>
              </div>
            </div>
          </div>

          {/* Section 2: Worker Selection */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="worker-select" className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <UserCheck size={14} className="text-[#800000]" /> ASSIGN TO WORKER
              </label>
              <select
                id="worker-select"
                value={selectedWorkerName}
                onChange={(e) => setSelectedWorkerName(e.target.value)}
                className="w-full text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] cursor-pointer"
              >
                <option value="" disabled>Select a worker ▼</option>
                {workers.map(w => {
                  const load = getWorkerWorkload(w.name);
                  return (
                    <option key={w.name} value={w.name}>
                      {w.name} — {w.role} ({load} active task{load === 1 ? '' : 's'})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* AVAILABLE WORKERS List */}
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">WORKER AVAILABILITY</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {workers.map(w => {
                  const workload = getWorkerWorkload(w.name);
                  const isSelected = selectedWorkerName === w.name;
                  const isAvailable = workload === 0;

                  return (
                    <div
                      key={w.name}
                      onClick={() => setSelectedWorkerName(w.name)}
                      className={`
                        p-2.5 rounded-lg border transition-all duration-150 cursor-pointer flex items-center gap-2.5
                        ${isSelected
                          ? 'bg-[#FFF5F5] border-[#800000] ring-1 ring-[#800000]'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                        }
                      `}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-[#800000] bg-[#800000]' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs font-bold truncate ${isSelected ? 'text-[#800000]' : 'text-slate-900'}`}>
                            {w.name}
                          </p>
                          {w.communicationMode === 'VOICE' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                              🎙️ AI Voice
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          {w.role} • <span className={isAvailable ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                            {isAvailable ? '🟢 Available' : `🔴 ${workload} active job${workload === 1 ? '' : 's'}`}
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#F7F9FC] border-t border-slate-200 px-6 py-3.5 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 transition cursor-pointer shadow-2xs"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleAssignSubmit}
            disabled={!selectedWorkerName || isSubmitting}
            className={`
              px-5 py-2 text-xs font-bold rounded-lg text-white transition-all flex items-center gap-2 cursor-pointer shadow-xs
              ${!selectedWorkerName || isSubmitting
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : 'bg-[#800000] hover:bg-[#990000] active:scale-95'
              }
            `}
          >
            <Wrench size={14} className={isSubmitting ? 'animate-spin' : ''} />
            <span>{isSubmitting ? 'Assigning…' : 'Assign Work Order'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
