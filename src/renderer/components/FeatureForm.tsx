import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Task, Feature, Status } from 'src/types/tasks'
import StatusBullet from './tasks/StatusBullet'
import StatusBadge from './tasks/StatusBadge'
import { DependencySelector } from './tasks/DependencySelector'
import { Modal } from './ui/Modal'
import type { TasksIndexSnapshot } from '../services/tasksService'
import type { ProjectsIndexSnapshot } from '../services/projectsService'

export type FeatureFormValues = {
  title: string
  description?: string
  rejection?: string
  status: Status
  dependencies?: string[]
}

type Props = {
  initialValues?: Partial<FeatureFormValues>
  onSubmit: (values: FeatureFormValues) => void | Promise<void>
  onCancel: () => void
  onDelete?: () => void
  submitting?: boolean
  titleRef?: React.RefObject<HTMLInputElement>
  allTasksSnapshot?: TasksIndexSnapshot
  allProjectsSnapshot?: ProjectsIndexSnapshot
  taskId: number
  featureId?: string
}

function validateDependencies(
  proposed: string[],
  snapshot: TasksIndexSnapshot,
  featureId?: string
): { ok: boolean; message?: string } {
  const invalid: string[] = []
  const nodes = new Set<string>()
  const graph = new Map<string, string[]>()
  const tasksById = snapshot.tasksById || {}

  Object.values(tasksById).forEach((task: Task) => {
    const tid = `${task.id}`
    nodes.add(tid)
    graph.set(tid, (task.dependencies || []))
    task.features.forEach((f: Feature) => {
      const fid = `${f.id}`
      nodes.add(fid)
      graph.set(fid, (f.dependencies || []))
    })
  })

  const unique = new Set(proposed)
  if (unique.size !== proposed.length) {
    return { ok: false, message: 'Duplicate dependencies' }
  }

  const proposedNodes: string[] = []
  for (const dep of proposed) {
    if (featureId && dep === featureId) {
      invalid.push(dep)
      continue
    }
    if (!nodes.has(dep)) {
      invalid.push(dep)
      continue
    }
    proposedNodes.push(dep)
  }
  if (invalid.length) {
    return { ok: false, message: `Invalid or self dependencies: ${invalid.join(', ')}` }
  }

  const thisNode = featureId ? `${featureId}` : "new"
  if (featureId) {
    graph.set(thisNode, proposedNodes)
  } else {
    nodes.add(thisNode)
    graph.set(thisNode, proposedNodes)
  }

  const visited = new Set<string>()
  const recStack = new Set<string>()
  function dfs(node: string): boolean {
    visited.add(node)
    recStack.add(node)
    const neighbors = graph.get(node) || []
    for (const nei of neighbors) {
      if (!visited.has(nei)) {
        if (dfs(nei)) return true
      } else if (recStack.has(nei)) {
        return true
      }
    }
    recStack.delete(node)
    return false
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (dfs(node)) {
        return { ok: false, message: 'Dependency cycle detected' }
      }
    }
  }
  return { ok: true }
}

export function FeatureForm({
  initialValues,
  onSubmit,
  onCancel,
  onDelete,
  submitting = false,
  titleRef,
  allTasksSnapshot,
  allProjectsSnapshot,
  taskId,
  featureId = undefined,
}: Props) {
  const [title, setTitle] = useState<string>(initialValues?.title ?? '')
  const [description, setDescription] = useState<string>(initialValues?.description ?? '')
  const [rejection, setRejection] = useState<string>(initialValues?.rejection ?? '')
  const [status, setStatus] = useState<Status>(initialValues?.status ?? '-')
  const [dependencies, setDependencies] = useState<string[]>(initialValues?.dependencies ?? [])
  const [error, setError] = useState<string | null>(null)
  const [depError, setDepError] = useState<string | null>(null)
  const [showSelector, setShowSelector] = useState(false)
  const [dragDepIndex, setDragDepIndex] = useState<number | null>(null)
  const [dropDepIndex, setDropDepIndex] = useState<number | null>(null)
  const [dropDepPos, setDropDepPos] = useState<'before' | 'after' | null>(null)

  const localTitleRef = useRef<HTMLInputElement>(null)
  const combinedTitleRef = titleRef ?? localTitleRef
  const isCreate = !(featureId !== null && featureId !== undefined)

  useEffect(() => {
    if (combinedTitleRef?.current) {
      combinedTitleRef.current.focus()
      combinedTitleRef.current.select?.()
    }
  }, [combinedTitleRef])

  const canSubmit = useMemo(() => title.trim().length > 0 && !submitting, [title, submitting])

  function validate(): boolean {
    let valid = true
    if (!title.trim()) {
      setError('Title is required')
      valid = false
    } else {
      setError(null)
    }
    if (allTasksSnapshot) {
      const depVal = validateDependencies(dependencies, allTasksSnapshot, featureId)
      if (!depVal.ok) {
        setDepError(depVal.message ?? 'Invalid dependencies')
        valid = false
      } else {
        setDepError(null)
      }
    }
    return valid
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!validate()) return
    const payload: FeatureFormValues = {
      title: title.trim(),
      description: description?.trim() || '',
      rejection: rejection?.trim() || undefined,
      status,
      dependencies,
    }
    await onSubmit(payload)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
      e.preventDefault()
      if (canSubmit) handleSubmit()
    }
  }

  function clearDepDnd() {
    setDragDepIndex(null)
    setDropDepIndex(null)
    setDropDepPos(null)
  }

  function computeDropForDep(e: React.DragEvent<HTMLElement>, idx: number) {
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    let pos: 'before' | 'after' | null = offsetY < rect.height / 2 ? 'before' : 'after'
    if (dragDepIndex != null && (idx === dragDepIndex || (idx === dragDepIndex - 1 && pos === 'after') || (idx === dragDepIndex + 1 && pos === 'before'))) {
      pos = null
    }
    setDropDepIndex(idx)
    setDropDepPos(pos)
  }

  function handleDepDrop() {
    if (dragDepIndex == null || dropDepIndex == null || dropDepPos == null) return
    const newDeps = [...dependencies]
    const [moved] = newDeps.splice(dragDepIndex, 1)
    const insertAt = dropDepPos === 'before' ? dropDepIndex : dropDepIndex + 1
    newDeps.splice(insertAt, 0, moved)
    setDependencies(newDeps)
    clearDepDnd()
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={onKeyDown} className="space-y-4" aria-label={isCreate ? 'Create Feature' : 'Edit Feature'}>
      <div className="grid grid-cols-1 gap-3">
        <div className="status-inline">
          <StatusBadge status={status} />
          <StatusBullet
            status={status}
            onChange={setStatus}
            className="reveal-on-hover"
          />
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="feature-title" className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
        </div>
        <input
          id="feature-title"
          ref={combinedTitleRef}
          type="text"
          placeholder="What is this feature?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
          className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
          style={{
            background: 'var(--surface-raised)',
            borderColor: error ? 'var(--status-stuck-soft-border)' : 'var(--border-default)',
            color: 'var(--text-primary)'
          }}
          aria-invalid={!!error}
          aria-describedby={error ? 'feature-title-error' : undefined}
        />
        {error ? (
          <div id="feature-title-error" className="text-xs" style={{ color: 'var(--status-stuck-fg)' }}>{error}</div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label htmlFor="feature-description" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Description</label>
          <textarea
            id="feature-description"
            rows={4}
            placeholder="Optional details or acceptance criteria"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="feature-rejection" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Rejection Reason</label>
          <textarea
            id="feature-rejection"
            rows={3}
            placeholder="Optional reason for rejection (leave blank to remove)"
            value={rejection}
            onChange={(e) => setRejection(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Dependencies</label>
          <ul
            className="dependencies-list border rounded-md min-h-[4rem] p-2 space-y-1"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDepDrop}
            onDragEnd={clearDepDnd}
          >
            {dependencies.map((dep, idx) => {
              const isDrag = idx === dragDepIndex
              const isDropBefore = dropDepIndex === idx && dropDepPos === 'before'
              const isDropAfter = dropDepIndex === idx && dropDepPos === 'after'
              return (
                <React.Fragment key={idx}>
                  {isDropBefore && <div className="drop-indicator" />}
                  <div
                    className={`dep-row flex items-center justify-between p-2 rounded bg-neutral-100 dark:bg-neutral-700 ${isDrag ? 'is-dragging opacity-50' : ''}`}
                    draggable
                    onDragStart={() => setDragDepIndex(idx)}
                    onDragOver={(e) => computeDropForDep(e, idx)}
                  >
                    <span>{dep}</span>
                    <button
                      type="button"
                      onClick={() => setDependencies(dependencies.filter((_, i) => i !== idx))}
                      className="text-sm text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                  {isDropAfter && <div className="drop-indicator" />}
                </React.Fragment>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => setShowSelector(true)}
            className="btn-secondary mt-2 self-start"
          >
            Add Dependency
          </button>
          {depError && (
            <div className="text-xs" style={{ color: 'var(--status-stuck-fg)' }}>
              {depError}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between gap-2 pt-2">
        {onDelete && !isCreate ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={submitting}
            className="btn"
            style={{
              background: 'var(--status-stuck-bg)',
              color: 'var(--status-stuck-fg)'
            }}
          >
            Delete
          </button>
        ) : null}
        <div className="flex justify-end gap-2 flex-1">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onCancel()}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn"
            disabled={!canSubmit}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            title="Cmd/Ctrl+Enter to submit"
          >
            {isCreate ? 'Create Feature' : 'Save Changes'}
          </button>
        </div>
      </div>

      {showSelector && (
        <Modal title="Select Dependency" onClose={() => setShowSelector(false)} isOpen={true} size="md">
          <DependencySelector
            allTasksSnapshot={allTasksSnapshot}
            allProjectsSnapshot={allProjectsSnapshot}
            onConfirm={(deps) => {
              const newDeps = deps.filter((d) => !dependencies.includes(d))
              setDependencies([...dependencies, ...newDeps])
              setShowSelector(false)
            }}
            currentTaskId={taskId}
            currentFeatureId={featureId}
            existingDeps={dependencies}
          />
        </Modal>
      )}
    </form>
  )
}

export default FeatureForm
