import React from 'react'
import type { Feature, Task } from '../../../../packages/factory-ts/src/types'

export function DependencySelector({ task, feature, onChange }: { task: Task; feature: Feature; onChange: (deps: string[]) => void }) {
  const deps = feature.dependencies || []
  return (
    <div className="flex flex-col gap-1">
      <label className="label">
        <span className="label-text">Dependencies</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {(task.features || []).map(f => (
          <label key={f.id} className="cursor-pointer">
            <input
              type="checkbox"
              checked={deps.includes(f.id)}
              onChange={e => {
                const next = new Set(deps)
                if (e.target.checked) next.add(f.id)
                else next.delete(f.id)
                onChange(Array.from(next))
              }}
            />
            <span className="ml-2 text-sm">{f.title}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
