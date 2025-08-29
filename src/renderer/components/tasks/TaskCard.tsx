import React from 'react'
import type { Task, Status } from 'src/types/tasks'
import Tooltip from '../ui/Tooltip'
import StatusControl from './StatusControl'

export default function TaskCard({ task, onClick, draggable = false, onDragStart, onStatusChange }: {
  task: Task
  onClick?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onStatusChange?: (status: Status) => void | Promise<void>
}) {
  return (
    <div
      className="task-card group"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { 
        if (e.key === 'Enter' || e.key === ' ') { 
          e.preventDefault(); 
          onClick?.() 
        } 
        if (onStatusChange && e.key.toLowerCase() === 's') {
          e.preventDefault();
          const order: Status[] = ['-', '~', '+', '=', '?'];
          const current = task.status;
          const idx = order.indexOf(current);
          const next = order[(idx + 1) % order.length];
          onStatusChange(next);
        }
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      aria-label={`Task ${task.id} ${task.title}`}
    >
      <div className="task-card__header">
        <div className="task-card__id">#{task.id}</div>
        <div className="flex-spacer" />
      </div>
      <div className="task-card__title" title={task.title}>{task.title}</div>
      <div className="task-card__meta flex items-center justify-between gap-2">
        <StatusControl status={task.status} onChange={onStatusChange} />
        <div className="task-card__actions opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 ease-out flex items-center gap-2">
          <Tooltip content="Open details (Enter)" placement="top">
            <button className="btn-secondary !px-2 !py-1 text-sm" onClick={(e) => { e.stopPropagation(); onClick?.(); }} aria-label="Open details">
              ↗
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
