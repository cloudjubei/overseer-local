import React from 'react'
import type { Task } from '../../../../packages/factory-ts/src/types'

export function TaskSummaryCallout({ task }: { task: Task }) {
  const total = (task.features || []).length
  const done = (task.features || []).filter(f => f.status === '+').length
  return (
    <div className="alert">
      <span>Task [{task.id}] has {done}/{total} features complete.</span>
    </div>
  )
}
