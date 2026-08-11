/**
 * KanbanBoard.jsx — Modern SaaS Sculpted Kanban Board with Micro-Interactions & Animations
 * Features smooth drag highlights, floating empty state icons, and interactive sculpted column cards.
 */
import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { updateTicket } from '../ticketsStore.js';
import TicketCard from './TicketCard.jsx';
import { ClipboardX, CircleDot, CheckCircle2, Sparkles } from 'lucide-react';

const COLUMNS = [
  {
    id: 'Unsolved',
    label: 'Unsolved Issues',
    icon: CircleDot,
    iconColor: 'text-red-500',
    headerBg: 'bg-gradient-to-r from-red-50 to-rose-50/70',
    headerText: 'text-red-900',
    colBorder: 'border-red-200/80',
    accentBg: 'bg-red-50/30',
    countBadge: 'bg-white/95 text-red-700 border border-red-200 shadow-2xs',
  },
  {
    id: 'Ongoing',
    label: 'In Progress',
    icon: ClipboardX,
    iconColor: 'text-amber-500',
    headerBg: 'bg-gradient-to-r from-amber-50 to-orange-50/70',
    headerText: 'text-amber-900',
    colBorder: 'border-amber-200/80',
    accentBg: 'bg-amber-50/30',
    countBadge: 'bg-white/95 text-amber-800 border border-amber-200 shadow-2xs',
  },
  {
    id: 'Completed',
    label: 'Solved & Closed',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    headerBg: 'bg-gradient-to-r from-emerald-50 to-teal-50/70',
    headerText: 'text-emerald-900',
    colBorder: 'border-emerald-200/80',
    accentBg: 'bg-emerald-50/30',
    countBadge: 'bg-white/95 text-emerald-800 border border-emerald-200 shadow-2xs',
  },
];

function EmptyState({ colId }) {
  const msgs = {
    Unsolved: { emoji: '🎉', text: 'All caught up! No unsolved issues.' },
    Ongoing:  { emoji: '⏳', text: 'No tickets currently in progress.' },
    Completed:{ emoji: '✅', text: 'No completed tickets logged yet.' },
  };
  const { emoji, text } = msgs[colId] || { emoji: '📭', text: 'Empty' };
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center text-slate-400 group cursor-default">
      <span className="text-4xl mb-3 animate-float-gentle transition-transform group-hover:scale-125 duration-300">{emoji}</span>
      <p className="text-xs font-black text-slate-700">{text}</p>
      <p className="text-[10px] mt-1 font-medium text-slate-400">Drag cards here to update status in real-time.</p>
    </div>
  );
}

export default function KanbanBoard({ tickets, onTicketSelect, onSolveTicket, onTicketsChange }) {
  const grouped = {
    Unsolved:  tickets.filter(t => t.status === 'Unsolved'),
    Ongoing:   tickets.filter(t => t.status === 'Ongoing'),
    Completed: tickets.filter(t => t.status === 'Completed'),
  };

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    updateTicket(draggableId, { status: destination.droppableId });
    onTicketsChange();
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {COLUMNS.map((col) => {
          const colTickets = grouped[col.id] || [];
          const ColIcon = col.icon;

          return (
            <div
              key={col.id}
              className={`rounded-[28px] border ${col.colBorder} overflow-hidden flex flex-col bg-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.04)] hover:shadow-xl transition-all duration-300`}
            >
              {/* Header with Frosted Gradient Wash Fills */}
              <div className={`${col.headerBg} border-b ${col.colBorder} px-5 py-4 flex items-center justify-between`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-white/90 shadow-2xs flex items-center justify-center border border-white">
                    <ColIcon size={16} className={`${col.iconColor} animate-pulse`} />
                  </div>
                  <h2 className={`text-xs font-black ${col.headerText} uppercase tracking-wider`}>
                    {col.label}
                  </h2>
                </div>
                <span className={`text-xs font-black px-3 py-1 rounded-full ${col.countBadge} animate-pop-badge`}>
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
                      flex-1 min-h-[300px] p-4 space-y-4
                      ${col.accentBg}
                      ${snapshot.isDraggingOver ? 'kanban-col-dragging-over' : ''}
                      transition-colors duration-200
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
  );
}
