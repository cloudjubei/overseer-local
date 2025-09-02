import React from 'react'
import type { Task } from '../../../packages/factory-ts/src/types'

export function TaskDetailsView({ task }: { task: Task }) {
  return (
    <div className="prose">
      <h2>[{task.id}] {task.title}</h2>
      <p>{task.description}</p>
    </div>
  )
}
