import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Status } from 'src/types/tasks'
import StatusControl from './tasks/StatusControl'
import { DependencySelector } from './tasks/DependencySelector'
import { Modal } from './ui/Modal'
import type { TasksIndexSnapshot } from '../../types/external'
import type { ProjectsIndexSnapshot } from '../services/projectsService'
import { taskService } from '../services/taskService'
import DependencyBullet from './tasks/DependencyBullet'
import { FileSelector } from './ui/FileSelector'
import ContextFileChip from './tasks/ContextFileChip'

export type FeatureFormValues = {
  title: string
  description?: string
  rejection?: string
  status: Status
  dependencies?: string[]
  context: string[]
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
  const [context, setContext] = useState<string[]>(initialValues?.context ?? [])
  const [error, setError] = useState<string | null>(null)
  const [depError, setDepError] = useState<string | null>(null)
  const [showSelector, setShowSelector] = useState(false)
  const [showFileSelector, setShowFileSelector] = useState(false)

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
    const result = taskService.validateDependencyList(contextRef, dependencies)
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
    const depVal = taskService.validateDependencyList(contextRef, dependencies)
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
      context,
    }
    await onSubmit(payload)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
      e.preventDefault()
      if (canSubmit) handleSubmit()
    }
  }

  function removeDependencyAt(idx: number) {
    setDependencies((deps) => deps.filter((_, i) => i !== idx))
  }

  function removeContextAt(idx: number) {
    setContext((ctx) => ctx.filter((_, i) => i !== idx))
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
            <label htmlFor="feature-description" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea
              id="feature-description"
              rows={4}
              placeholder="Optional details or acceptance criteria"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60 resize-y max-h-64"
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
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60 resize-y max-h-64"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Context Files</label>
          <div className="flex flex-wrap gap-2 border rounded-md min-h-[3rem] p-2" style={{ borderColor: 'var(--border-default)', background: 'var(--surface-raised)' }}>
            {context.map((p, idx) => (
              <ContextFileChip key={p} path={p} onRemove={() => removeContextAt(idx)} />
            ))}
            <button type="button" onClick={() => setShowFileSelector(true)} className="chip chip--ok" title="Add context files">
              <span>Add</span>
              <span aria-hidden>+</span>
            </button>
          </div>
          <div className="text-xs text-text-muted">Select any files across the project that provide useful context for this feature.</div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="feature-dependencies" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Dependencies</label>
          <div
            id="feature-dependencies"
            className="chips-list border rounded-md min-h-[3rem] p-2"
            aria-invalid={!!depError}
            aria-describedby={depErrorId}
            style={{
              borderColor: depError ? 'var(--status-stuck-soft-border)' : 'var(--border-default)',
              background: 'var(--surface-raised)'
            }}
          >
            {dependencies.map((dep, idx) => {
              return (
                <DependencyBullet key={dep} dependency={dep} onRemove={() => removeDependencyAt(idx)} isInbound/>
              )
            })}
            <button
              type="button"
              onClick={() => setShowSelector(true)}
              className="chip chip--ok"
              title="Add dependency"
            >
              <span>Add</span>
              <span aria-hidden="true">+</span>
            </button>
          </div>
          {depError && (
            <div id={depErrorId} className="text-xs" style={{ color: 'var(--status-stuck-bg)' }}>
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

      {showFileSelector && (
        <Modal title="Select Context Files" onClose={() => setShowFileSelector(false)} isOpen={true} size="lg">
          <FileSelector
            selected={context}
            onCancel={() => setShowFileSelector(false)}
            onConfirm={(paths) => {
              const unique = Array.from(new Set([...(context || []), ...paths]))
              setContext(unique)
              setShowFileSelector(false)
            }}
            allowMultiple
          />
        </Modal>
      )}
    </form>
  )
}

export default FeatureForm
