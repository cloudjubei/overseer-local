import React from 'react'
import type { Task } from 'src/types/tasks'
import StatusBadge from './StatusBadge'
import PriorityTag, { parsePriorityFromTitle } from './PriorityTag'

export default function TaskCard({ task, onClick, draggable = false, onDragStart }: {
  task: Task
  onClick?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}) {
  const p = parsePriorityFromTitle(task.title)
  return (
    <div
      className="task-card"
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
      <div className="task-card__meta">
        <StatusBadge status={task.status} variant="soft" />
      </div>
    </div>
  )
}
