import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Task, Feature, Status } from 'src/types/tasks'
import StatusControl from './tasks/StatusControl'
import { DependencySelector } from './tasks/DependencySelector'
import { Modal } from './ui/Modal'
import type { TasksIndexSnapshot } from '../services/tasksService'
import type { ProjectsIndexSnapshot } from '../services/projectsService'
import { dependencyResolver } from '../services/dependencyResolver'

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

  // Live dependency validation so errors show immediately in UI
  useEffect(() => {
    const contextRef = featureId ? `${featureId}` : null
    const result = dependencyResolver.validateDependencyList(contextRef, dependencies)
    if (!result.ok) {
      setDepError(result.message ?? 'Invalid dependencies')
    } else {
      setDepError(null)
    }
  }, [dependencies, featureId])

  const canSubmit = useMemo(() => title.trim().length > 0 && !submitting && !depError, [title, submitting, depError])

  function validate(): boolean {
    let valid = true
    if (!title.trim()) {
      setError('Title is required')
      valid = false
    } else {
      setError(null)
    }

    const contextRef = featureId ? `${featureId}` : null
    const depVal = dependencyResolver.validateDependencyList(contextRef, dependencies)
    if (!depVal.ok) {
      setDepError(depVal.message ?? 'Invalid dependencies')
      valid = false
    } else {
      setDepError(null)
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

  const depErrorId = depError ? 'feature-deps-error' : undefined

  return (
    <form onSubmit={handleSubmit} onKeyDown={onKeyDown} className="space-y-4" aria-label={isCreate ? 'Create Feature' : 'Edit Feature'}>
      <div className="grid grid-cols-1 gap-3">
        <StatusControl
          status={status}
          onChange={setStatus}
        />
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
          <label htmlFor="feature-dependencies" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Dependencies</label>
          <ul
            id="feature-dependencies"
            className="dependencies-list border rounded-md min-h-[4rem] p-2 space-y-1 overflow-y-auto max-h-64"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDepDrop}
            onDragEnd={clearDepDnd}
            aria-invalid={!!depError}
            aria-describedby={depErrorId}
            style={{
              borderColor: depError ? 'var(--status-stuck-soft-border)' : 'var(--border-default)',
              background: 'var(--surface-raised)'
            }}
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
            <div id={depErrorId} className="text-xs" style={{ color: 'var(--status-stuck-fg)' }}>
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
