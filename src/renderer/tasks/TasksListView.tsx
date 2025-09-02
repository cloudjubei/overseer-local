import React from 'react'
import type { Task } from '../../../packages/factory-ts/src/types'

export function TasksListView({ tasks, onSelect }: { tasks: Task[]; onSelect?: (t: Task) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {tasks.map(t => (
        <div key={t.id} className="card bg-base-100 shadow cursor-pointer" onClick={() => onSelect?.(t)}>
          <div className="card-body">
            <div className="card-title">[{t.id}] {t.title}</div>
            <div className="text-sm opacity-70">{t.description}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
