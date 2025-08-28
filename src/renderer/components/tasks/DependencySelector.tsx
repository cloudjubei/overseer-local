import React, { useMemo, useState } from 'react'
import type { ProjectSpec } from 'src/types/tasks'
import type { TasksIndexSnapshot } from '../../services/tasksService'
import type { ProjectsIndexSnapshot } from '../../services/projectsService'

type DependencySelectorProps = {
  allTasksSnapshot?: TasksIndexSnapshot
  allProjectsSnapshot?: ProjectsIndexSnapshot
  onConfirm?: (deps: string[]) => void
  currentTaskId?: number
  currentFeatureId?: string
  existingDeps?: string[]
}

function getTaskIdsForProject(spec: ProjectSpec): number[] {
  const ids = new Set<number>()
  spec.requirements.forEach((r) => r.tasks.forEach((id) => ids.add(id)))
  return Array.from(ids).sort((a, b) => a - b)
}

function doesTaskMatch(task: any, q: string): boolean {
  return (
    task.title.toLowerCase().includes(q) ||
    (task.description || '').toLowerCase().includes(q)
  )
}

function doesFeatureMatch(f: any, q: string): boolean {
  return (
    f.title.toLowerCase().includes(q) ||
    (f.description || '').toLowerCase().includes(q)
  )
}

function doesProjectMatch(project: ProjectSpec, tasksById: Record<number, any>, q: string): boolean {
  if (project.title.toLowerCase().includes(q) || (project.description || '').toLowerCase().includes(q)) return true
  const taskIds = getTaskIdsForProject(project)
  for (const tid of taskIds) {
    const task = tasksById[tid]
    if (!task) continue
    if (doesTaskMatch(task, q)) return true
    if (task.features.some((f: any) => doesFeatureMatch(f, q))) return true
  }
  return false
}

export const DependencySelector: React.FC<DependencySelectorProps> = ({
  allTasksSnapshot,
  allProjectsSnapshot,
  onConfirm,
  currentTaskId,
  currentFeatureId,
  existingDeps = [],
}) => {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const q = search.trim().toLowerCase()

  const toggle = (dep: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(dep)) {
      newSelected.delete(dep)
    } else {
      newSelected.add(dep)
    }
    setSelected(newSelected)
  }

  if (!allTasksSnapshot || !allProjectsSnapshot) {
    return <div>Loading dependencies...</div>
  }

  const tasksById = allTasksSnapshot.tasksById || {}
  const projectsById = allProjectsSnapshot.projectsById || {}
  const filteredProjects = allProjectsSnapshot.orderedIds
    .map((id) => projectsById[id])
    .filter((p) => !q || doesProjectMatch(p, tasksById, q))

  const allAssigned = new Set<number>(
    allProjectsSnapshot.orderedIds.flatMap((id) => getTaskIdsForProject(projectsById[id]))
  )
  const unassignedIds = Object.keys(tasksById)
    .map(Number)
    .filter((tid) => !allAssigned.has(tid))
    .sort((a, b) => a - b)
    .filter((tid) => {
      const task = tasksById[tid]
      if (!task) return false
      if (!q) return true
      if (doesTaskMatch(task, q)) return true
      return task.features.some((f: any) => doesFeatureMatch(f, q))
    })

  const renderTaskItem = (tid: number, isUnassigned = false) => {
    const task = tasksById[tid]
    if (!task) return null
    const dep = `${tid}`
    const isDisabled = existingDeps.includes(dep)
    const taskMatches = !q || doesTaskMatch(task, q)
    const matchingFeatures = task.features.filter((f) => !q || doesFeatureMatch(f, q))
    if (!taskMatches && matchingFeatures.length === 0) return null

    return (
      <li key={tid}>
        <div
          className={`selector-item ${isDisabled ? 'disabled text-neutral-400 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
        >
          <input
            type="checkbox"
            checked={selected.has(dep)}
            onChange={() => toggle(dep)}
            disabled={isDisabled}
          />
          #{tid} {task.title} (Task)
        </div>
        <ul className="ml-4 space-y-1">
          {matchingFeatures.map((f) => {
            const fdep = `${tid}.${f.id}`
            const isSelf = currentTaskId === tid && currentFeatureId === f.id
            const isFDisabled = isSelf || existingDeps.includes(fdep)
            return (
              <li
                key={f.id}
                className={`selector-item ${isFDisabled ? 'disabled text-neutral-400 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(fdep)}
                  onChange={() => toggle(fdep)}
                  disabled={isFDisabled}
                />
                #{fdep} {f.title} (Feature)
              </li>
            )
          })}
        </ul>
      </li>
    )
  }

  return (
    <div className="dependency-selector">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tasks or features"
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      <div className="mt-4 space-y-4 max-h-96 overflow-auto">
        {filteredProjects.map((project) => (
          <div key={project.id}>
            <h3 className="text-lg font-semibold">{project.title}</h3>
            <ul className="space-y-2">
              {getTaskIdsForProject(project).map((tid) => renderTaskItem(tid))}
            </ul>
          </div>
        ))}
        {unassignedIds.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold">Other Tasks</h3>
            <ul className="space-y-2">
              {unassignedIds.map((tid) => renderTaskItem(tid, true))}
            </ul>
          </div>
        )}
      </div>
      <button
        className="btn mt-4"
        disabled={selected.size === 0}
        onClick={() => {
          onConfirm?.(Array.from(selected))
          setSelected(new Set())
        }}
      >
        Add {selected.size} Selected
      </button>
    </div>
  )
}
