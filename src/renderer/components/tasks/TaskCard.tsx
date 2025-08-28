import React from 'react'
import type { Task } from 'src/types/tasks'
import PriorityTag, { parsePriorityFromTitle } from './PriorityTag'
import Tooltip from '../ui/Tooltip'
import StatusControl from './StatusControl'

export default function TaskCard({ task, onClick, draggable = false, onDragStart }: {
  task: Task
  onClick?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}) {
  const p = parsePriorityFromTitle(task.title)
  return (
    <div
      className="task-card group"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      draggable={draggable}
      onDragStart={onDragStart}
      aria-label={`Task ${task.id} ${task.title}`}
    >
      <div className="task-card__header">
        <div className="task-card__id">#{task.id}</div>
        <div className="flex-spacer" />
        <PriorityTag priority={p} />
      </div>
      <div className="task-card__title" title={task.title}>{task.title}</div>
      <div className="task-card__meta flex items-center justify-between gap-2">
        <StatusControl status={task.status} variant="soft" />
        <div className="task-card__actions opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 ease-out flex items-center gap-2">
          <Tooltip content="Open details (Enter)" placement="top">
            <button className="btn-secondary !px-2 !py-1 text-sm" onClick={(e) => { e.stopPropagation(); onClick?.(); }} aria-label="Open details">
              ↗
            </button>
          </Tooltip>
          <Tooltip content="Change status (S)" placement="top">
            <button className="btn-secondary !px-2 !py-1 text-sm" aria-label="Change status">
              S
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
