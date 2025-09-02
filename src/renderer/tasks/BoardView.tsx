import React from 'react'
import type { Task } from '../../..//packages/factory-ts/src/types'

export function BoardView({ tasks }: { tasks: Task[] }) {
  const groups: Record<string, Task[]> = { '-': [], '~': [], '+': [], '?': [], '=': [] }
  for (const t of tasks) {
    const s = (t.status || '-') as keyof typeof groups
    if (!groups[s]) groups[s] = []
    groups[s].push(t)
  }
  return (
    <div className="grid grid-cols-5 gap-4">
      {Object.entries(groups).map(([status, list]) => (
        <div key={status} className="bg-base-200 rounded p-2">
          <div className="font-bold mb-2">{status}</div>
          <div className="flex flex-col gap-2">
            {list.map(t => (
              <div key={t.id} className="card bg-base-100 shadow">
                <div className="card-body">
                  <div className="card-title">[{t.id}] {t.title}</div>
                  <div className="text-sm">{t.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
