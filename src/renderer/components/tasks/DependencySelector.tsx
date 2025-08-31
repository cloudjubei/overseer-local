import React, { useState } from 'react'
import type { Feature, ProjectSpec, Task } from 'src/types/tasks'
// import { useActiveProject } from 'src/renderer/projects/ProjectContext'
// import { useTasks } from 'src/renderer/hooks/useTasks'

type DependencySelectorProps = {
  onConfirm?: (deps: string[]) => void
  currentTaskId?: string
  currentFeatureId?: string
  existingDeps?: string[]
}

function doesTaskMatch(project: ProjectSpec, task: Task, q: string): boolean {
  return (
    `${task.id}`.toLowerCase().includes(q) ||
    task.title.toLowerCase().includes(q) ||
    (task.description || '').toLowerCase().includes(q)
  )
}

function doesFeatureMatch(task: Task, f: Feature, q: string): boolean {
  return (
    `${f.id}`.toLowerCase().includes(q) ||
    f.title.toLowerCase().includes(q) ||
    (f.description || '').toLowerCase().includes(q)
  )
}

export const DependencySelector: React.FC<DependencySelectorProps> = ({
  onConfirm,
  currentTaskId,
  currentFeatureId,
  existingDeps = [],
}) => {
  const project : ProjectSpec | undefined = undefined
  // const { project } = useActiveProject()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // const { projectsById } = useProjects() //TODO:
  // const { tasksById } = useTasks()
  const tasksById : Record<string,Task> = {}

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

  if (!project) {
    return <div>Loading dependencies...</div>
  }

  const allAssigned = new Set<number>() //TODO:
  // const allAssigned = new Set<number>(
  //   allProjectsSnapshot.orderedIds.flatMap((id) => getTaskIdsForProject(projectsById[id]))
  // )
  const allAssignedIds = Array.from(allAssigned)
  const unassignedIds = Object.keys(tasksById)
    .map(Number)
    .filter((tid) => !allAssigned.has(tid))
    .sort((a, b) => a - b)
    .filter((tid) => {
      const task = tasksById[tid]
      if (!task) return false
      if (!q) return true
      if (doesTaskMatch(project, task, q)) return true
      return task.features.some((f: any) => doesFeatureMatch(task, f, q))
    })

  const renderTaskItem = (tid: number, isUnassigned = false) => {
    const task = tasksById[tid]
    if (!task) return null
    const dep = `${tid}`
    const isDisabled = existingDeps.includes(dep)
    const taskMatches = !q || doesTaskMatch(project, task, q)
    const matchingFeatures = task.features.filter((f) => !q || doesFeatureMatch(task, f, q))
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
          {matchingFeatures.map((f: Feature) => {
            const isSelf = currentTaskId === tid && currentFeatureId === f.id
            const isFDisabled = isSelf || existingDeps.includes(f.id)
            const dependencyDisplay = "x.x" //TODO: task.fea
            return (
              <li
                key={f.id}
                className={`selector-item ${isFDisabled ? 'disabled text-neutral-400 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(f.id)}
                  onChange={() => toggle(f.id)}
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
        <div>
          <h3 className="text-lg font-semibold">{project.title}</h3>
          <ul className="space-y-2">
            {allAssignedIds.map((tid) => renderTaskItem(tid))}
          </ul>
        </div>
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
