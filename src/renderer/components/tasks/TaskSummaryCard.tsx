import React from 'react'
import type { Task } from '../../../../packages/factory-ts/src/types'

export function TaskSummaryCard({ task, onClick }: { task: Task; onClick?: () => void }) {
  const total = (task.features || []).length
  const done = (task.features || []).filter(f => f.status === '+').length
  return (
    <div className="card bg-base-200 shadow cursor-pointer" onClick={onClick}>
      <div className="card-body">
        <h3 className="card-title">[{task.id}] {task.title}</h3>
        <div className="text-sm">{done}/{total} features complete</div>
      </div>
    </div>
  )
}
