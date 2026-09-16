/**
 * KanbanBoard.jsx — 4-Column Complaint Management Board (Light MCC Theme)
 * Features 4 clean columns:
 * 1. UNSOLVED ISSUES
 * 2. IN PROGRESS
 * 3. AWAITING USER CONFIRMATION
 * 4. RESOLVED & CLOSED
 */
import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { updateTicket } from '../ticketsStore.js';
import TicketCard from './TicketCard.jsx';
import { CircleDot, Clock, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';

const COLUMNS = [
  {
    id: 'Unsolved',
    label: 'UNSOLVED ISSUES',
    icon: CircleDot,
    headerBg: 'bg-[#FEF2F2]',
    headerText: 'text-[#991B1B]',
    colBorder: 'border-[#FCA5A5]/60',
    accentBg: 'bg-[#FEF2F2]/20',
    countBadge: 'bg-[#991B1B] text-white',
  },
  {
    id: 'Ongoing',
    label: 'IN PROGRESS',
    icon: Clock,
    headerBg: 'bg-[#FFF7ED]',
    headerText: 'text-[#C2410C]',
    colBorder: 'border-[#FDBA74]/60',
    accentBg: 'bg-[#FFF7ED]/20',
    countBadge: 'bg-[#C2410C] text-white',
  },
  {
    id: 'Awaiting',
    label: 'AWAITING USER CONFIRMATION',
    icon: AlertCircle,
    headerBg: 'bg-[#FEFCE8]',
    headerText: 'text-[#A16207]',
    colBorder: 'border-[#FDE047]/60',
    accentBg: 'bg-[#FEFCE8]/20',
    countBadge: 'bg-[#A16207] text-white',
  },
  {
    id: 'Completed',
    label: 'RESOLVED & CLOSED',
    icon: CheckCircle2,
    headerBg: 'bg-[#F0FDF4]',
    headerText: 'text-[#15803D]',
    colBorder: 'border-[#86EFAC]/60',
    accentBg: 'bg-[#F0FDF4]/20',
    countBadge: 'bg-[#15803D] text-white',
  },
];

function EmptyState({ colId }) {
  const msgs = {
    Unsolved: { emoji: '🎉', text: 'No unsolved issues' },
    Ongoing:  { emoji: '⏳', text: 'No tickets in progress' },
    Awaiting: { emoji: '📬', text: 'No tickets awaiting user confirmation' },
    Completed:{ emoji: '✅', text: 'No resolved tickets logged yet' },
  };
  const { emoji, text } = msgs[colId] || { emoji: '📭', text: 'Empty' };
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
      <span className="text-3xl mb-2">{emoji}</span>
      <p className="text-xs font-bold text-slate-600">{text}</p>
    </div>
  );
}

export default function KanbanBoard({ tickets, onTicketSelect, onSolveTicket, onAssignWork, onTicketsChange }) {
  const [activeTab, setActiveTab] = React.useState('All');

  const grouped = {
    Unsolved:  tickets.filter(t => t.status === 'Unsolved'),
    Ongoing:   tickets.filter(t => t.status === 'Ongoing' || t.status === 'Reopened'),
    Awaiting:  tickets.filter(t => t.status === 'Awaiting User Confirmation'),
    Completed: tickets.filter(t => t.status === 'Completed' || t.status === 'Resolved'),
  };

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    let targetStatus = destination.droppableId;
    if (targetStatus === 'Awaiting') targetStatus = 'Awaiting User Confirmation';

    updateTicket(draggableId, { status: targetStatus });
    onTicketsChange();
  };

  const visibleCols = activeTab === 'All'
    ? COLUMNS
    : COLUMNS.filter(c => c.id === activeTab);

  return (
    <div className="space-y-4">
      {/* Mobile Column Switcher */}
      <div className="flex items-center gap-1.5 xl:hidden bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('All')}
          className={`flex-1 min-w-[70px] py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'All'
              ? 'bg-[#800000] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All ({tickets.length})
        </button>
        {COLUMNS.map(col => (
          <button
            key={col.id}
            type="button"
            onClick={() => setActiveTab(col.id)}
            className={`flex-1 min-w-[100px] py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === col.id
                ? 'bg-[#800000] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>{col.label.split(' ')[0]}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800">
              {(grouped[col.id] || []).length}
            </span>
          </button>
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {visibleCols.map((col) => {
            const colTickets = grouped[col.id] || [];
            const ColIcon = col.icon;

            return (
              <div
                key={col.id}
                className={`rounded-2xl border ${col.colBorder} overflow-hidden flex flex-col bg-white shadow-xs transition-all duration-200`}
              >
                {/* Header */}
                <div className={`${col.headerBg} border-b ${col.colBorder} px-4 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <ColIcon size={16} className={col.headerText} />
                    <h2 className={`text-xs font-extrabold ${col.headerText} tracking-tight`}>
                      {col.label}
                    </h2>
                  </div>
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${col.countBadge}`}>
                    {colTickets.length}
                  </span>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`
                        flex-1 min-h-[280px] p-3 space-y-3
                        ${col.accentBg}
                        ${snapshot.isDraggingOver ? 'ring-2 ring-inset ring-[#800000]/30' : ''}
                        transition-colors duration-150
                      `}
                    >
                      {colTickets.length === 0 ? (
                        <EmptyState colId={col.id} />
                      ) : (
                        colTickets.map((ticket, index) => (
                          <Draggable
                            key={ticket.ticketNo}
                            draggableId={ticket.ticketNo}
                            index={index}
                          >
                            {(prov, snap) => (
                              <TicketCard
                                ticket={ticket}
                                onSelect={onTicketSelect}
                                onSolveTicket={onSolveTicket}
                                onAssignWork={onAssignWork}
                                provided={prov}
                                snapshot={snap}
                              />
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
