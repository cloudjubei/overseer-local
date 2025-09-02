import React from 'react'
import type { Task } from '../../../../packages/factory-ts/src/types'

export function TaskCard({ task, onClick }: { task: Task; onClick?: () => void }) {
  return (
    <div className="card bg-base-100 shadow cursor-pointer hover:shadow-lg" onClick={onClick}>
      <div className="card-body">
        <h3 className="card-title">[{task.id}] {task.title}</h3>
        <p className="text-sm opacity-70">{task.description}</p>
      </div>
    </div>
  )
}
