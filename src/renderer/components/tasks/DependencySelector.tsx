import React, { useMemo, useState } from 'react'
import { Task } from 'src/types/tasks'

type DependencySelectorProps = {
  allTasks: Task[]
  onSelect: (dep: string) => void
  currentTaskId?: number
  currentFeatureId?: string
  existingDeps?: string[]
}

export const DependencySelector: React.FC<DependencySelectorProps> = ({
  allTasks,
  onSelect,
  currentTaskId,
  currentFeatureId,
  existingDeps,
}) => {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allTasks.filter((task) => {
      const taskMatches =
        `${task.id}`.includes(q) ||
        task.title.toLowerCase().includes(q) ||
        task.description?.toLowerCase().includes(q) || ''
      const featureMatches = task.features.some(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q) || ''
      )
      return taskMatches || featureMatches
    })
  }, [allTasks, search])

  return (
    <div className="dependency-selector">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tasks or features"
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      <ul className="mt-4 space-y-2">
        {filtered.map((task) => (
          <li key={task.id}>
            <div
              className={`selector-item ${existingDeps?.includes(`${task.id}`) ? 'disabled text-neutral-400 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
              onClick={() =>
                !existingDeps?.includes(`${task.id}`) && onSelect(`${task.id}`)
              }
            >
              #{task.id} {task.title} (Task)
            </div>
            <ul className="ml-4 space-y-1">
              {task.features
                .filter((f) => {
                  const fm =
                    f.title.toLowerCase().includes(search.toLowerCase()) ||
                    f.description?.toLowerCase().includes(search.toLowerCase()) || ''
                  return search ? fm : true
                })
                .map((f) => {
                  const dep = `${task.id}.${f.id}`
                  const isSelf =
                    currentTaskId === task.id && currentFeatureId === f.id
                  const isExisting = existingDeps?.includes(dep)
                  return (
                    <li
                      key={f.id}
                      className={`selector-item ${isSelf || isExisting ? 'disabled text-neutral-400 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
                      onClick={() => !isSelf && !isExisting && onSelect(dep)}
                    >
                      #{task.id}.{f.id} {f.title} (Feature)
                    </li>
                  )
                })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
