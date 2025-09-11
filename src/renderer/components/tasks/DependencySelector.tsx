import React, { useState } from 'react'
import { useActiveProject } from '../../../renderer/contexts/ProjectContext'
import type { Feature, ProjectSpec, Task } from 'thefactory-tools';
import { useTasks } from '../../../renderer/hooks/useTasks'

type DependencySelectorProps = {
  onConfirm?: (deps: string[]) => void
  currentTaskId?: string
  currentFeatureId?: string
  existingDeps?: string[]
}

function doesTaskMatch(project: ProjectSpec, selected: Set<string>, task: Task, q: string): boolean {
  const display = `${project.taskIdToDisplayIndex[task.id]}`
  return (
    display.toLowerCase().includes(q) ||
    task.title.toLowerCase().includes(q) ||
    (task.description || '').toLowerCase().includes(q)
  )
}

function doesFeatureMatch(project: ProjectSpec, selected: Set<string>, task: Task, f: Feature, q: string): boolean {
  const display = `${project.taskIdToDisplayIndex[task.id]}.${task.featureIdToDisplayIndex[f.id]}`
  return (
    display.toLowerCase().includes(q) ||
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
  const { project } = useActiveProject()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(existingDeps))
  const { tasksById } = useTasks()

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
    return <div>Loading blockers...</div>
  }

  const renderTaskItem = (project: ProjectSpec, taskId: string) => {
    const task = tasksById[taskId]
    if (!task) return null
    const taskDep = `${taskId}`
    const isDisabled = existingDeps.includes(taskDep)
    const taskMatches = !q || doesTaskMatch(project, selected, task, q)
    const matchingFeatures = task.features.filter((f) => !q || doesFeatureMatch(project, selected, task, f, q))
    if (!taskMatches && matchingFeatures.length === 0) return null

    const display = `${project.taskIdToDisplayIndex[taskId]}`

    return (
      <li key={taskId}>
        <div
          className={`selector-item flex gap-2 ${isDisabled ? 'disabled text-neutral-400 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
        >
          <input
            type="checkbox"
            checked={selected.has(taskDep)}
            onChange={() => toggle(taskDep)}
            disabled={isDisabled}
          />
          #{display} {task.title}
        </div>
        <ul className="ml-4 space-y-1">
          {matchingFeatures.map((f: Feature) => {
            const featureDep = `${taskId}.${f.id}`
            const isSelf = currentTaskId === taskId && currentFeatureId === f.id
            const isFDisabled = isSelf || existingDeps.includes(featureDep)
            const featureDisplay = `${display}.${task.featureIdToDisplayIndex[f.id]}`
            return (
              <li
                key={`${featureDep}`}
                className={`selector-item flex gap-2 ${isFDisabled ? 'disabled text-neutral-400 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(featureDep)}
                  onChange={() => toggle(featureDep)}
                  disabled={isFDisabled}
                />
                #{featureDisplay} {f.title}
              </li>
            )
          })}
        </ul>
      </li>
    )
  }

  const taskIds = Object.keys(tasksById).sort((a,b) => project.taskIdToDisplayIndex[a] - project.taskIdToDisplayIndex[b])

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
        </div>
        {taskIds.length > 0 && (
          <ul className="space-y-2">
            {taskIds.map((taskId) => renderTaskItem(project, taskId))}
          </ul>
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
