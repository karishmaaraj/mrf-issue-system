/**
 * WorkerGrid.jsx — Worker Overview Section (Light MCC Theme)
 * Displays compact worker cards with real worker data from systemConfigStore and real active ticket workloads.
 */
import React from 'react';

export default function WorkerGrid({ workers = [], tickets = [], onAssignWorker, onEmailWorker }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          Worker Overview
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Current workload and availability
        </p>
      </div>

      {/* Grid of Compact Worker Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {workers.map((worker) => {
          const activeTickets = tickets.filter(
            t => t.assignedWorker === worker.name &&
                 t.status !== 'Completed' &&
                 t.status !== 'Resolved' &&
                 t.status !== 'Archived'
          );
          const activeCount = activeTickets.length;
          const isAvailable = activeCount === 0;

          return (
            <div
              key={worker.name}
              className="p-3.5 rounded-xl border border-slate-200/80 bg-[#F7F9FC]/60 hover:bg-white hover:border-[#800000]/40 transition-all duration-200 flex flex-col justify-between space-y-2 group shadow-2xs"
            >
              <div className="space-y-1">
                {/* Worker Name */}
                <p className="text-xs font-bold text-slate-900 group-hover:text-[#800000] transition-colors truncate">
                  {worker.name}
                </p>

                {/* Role / Specialization */}
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  {worker.role}
                </p>
              </div>

              {/* Status & Workload Indicator */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <span className={`text-[11px] font-bold flex items-center gap-1.5 ${
                  isAvailable ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  <span>{isAvailable ? '🟢' : '🔴'}</span>
                  <span>{isAvailable ? 'Available' : `${activeCount} active job${activeCount === 1 ? '' : 's'}`}</span>
                </span>

                {onEmailWorker && (
                  <button
                    type="button"
                    onClick={() => onEmailWorker(worker)}
                    title={`Send email to ${worker.name}`}
                    className="text-[10px] font-bold text-[#800000] hover:underline cursor-pointer"
                  >
                    Email
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
