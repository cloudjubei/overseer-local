import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Status } from 'thefactory-tools'
import StatusControl from './StatusControl'
import { DependencySelector } from './DependencySelector'
import DependencyBullet from './DependencyBullet'
import { FileSelector } from '../ui/FileSelector'
import ContextFileChip from './ContextFileChip'
import { Modal } from '../ui/Modal'
import { IconDelete, IconPlus } from '../ui/Icons'
import FileMentionsTextarea from '../ui/FileMentionsTextarea'
import { useTasks } from '../../contexts/TasksContext'
import { Button } from '../ui/Button'

export type FeatureFormValues = {
  title: string
  description?: string
  rejection?: string
  status: Status
  blockers?: string[]
  context: string[]
}

type Props = {
  initialValues?: Partial<FeatureFormValues>
  onSubmit: (values: FeatureFormValues) => void | Promise<void>
  onCancel: () => void
  onDelete?: () => void
  submitting?: boolean
  titleRef?: React.RefObject<HTMLInputElement>
  taskId: string
  featureId?: string
  // When true, the form will not render inline action buttons at the bottom.
  // Use this when placing actions in a parent Modal footer to keep them sticky.
  hideActions?: boolean
  // Optional id to bind external submit buttons using the `form` attribute
  formId?: string
  onDirtyChange?: (dirty: boolean) => void
}

export default function FeatureForm({
  initialValues,
  onSubmit,
  onCancel,
  onDelete,
  submitting = false,
  titleRef,
  taskId,
  featureId = undefined,
  hideActions = false,
  formId,
  onDirtyChange,
}: Props) {
  const [title, setTitle] = useState<string>(initialValues?.title ?? '')
  const [description, setDescription] = useState<string>(initialValues?.description ?? '')
  const [rejection, setRejection] = useState<string>(initialValues?.rejection ?? '')
  const [status, setStatus] = useState<Status>(initialValues?.status ?? '-')
  const [blockers, setBlockers] = useState<string[]>(initialValues?.blockers ?? [])
  const [context, setContext] = useState<string[]>(initialValues?.context ?? [])
  const [error, setError] = useState<string | null>(null)
  const [showSelector, setShowSelector] = useState(false)
  const [showFileSelector, setShowFileSelector] = useState(false)

  const { normalizeDependency } = useTasks()

  const localTitleRef = useRef<HTMLInputElement>(null)
  const combinedTitleRef = titleRef ?? localTitleRef
  const isCreate = !(featureId !== null && featureId !== undefined)

  // Baseline snapshot for dirty tracking
  const initialSnapshotRef = useRef<{
    title: string
    description: string
    rejection: string
    status: Status
    blockers: string[]
    context: string[]
  } | null>(null)
  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = {
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      rejection: initialValues?.rejection ?? '',
      status: initialValues?.status ?? '-',
      blockers: initialValues?.blockers ?? [],
      context: initialValues?.context ?? [],
    }
  }

  useEffect(() => {
    if (combinedTitleRef?.current) {
      combinedTitleRef.current.focus()
      combinedTitleRef.current.select?.()
    }
  }, [combinedTitleRef])

  // Dirty tracking
  useEffect(() => {
    const baseline = initialSnapshotRef.current!
    const dirty =
      title !== baseline.title ||
      description !== baseline.description ||
      rejection !== baseline.rejection ||
      status !== baseline.status ||
      blockers.length !== baseline.blockers.length ||
      context.length !== baseline.context.length ||
      blockers.some((b, i) => b !== baseline.blockers[i]) ||
      context.some((c, i) => c !== baseline.context[i])
    onDirtyChange?.(dirty)
  }, [title, description, rejection, status, blockers, context, onDirtyChange])

  const canSubmit = useMemo(() => title.trim().length > 0 && !submitting, [title, submitting])

  function validate(): boolean {
    let valid = true
    if (!title.trim()) {
      setError('Title is required')
      valid = false
    } else {
      setError(null)
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
      blockers,
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

  function removeBlockerAt(idx: number) {
    setBlockers((deps) => deps.filter((_, i) => i !== idx))
  }

  function removeContextAt(idx: number) {
    setContext((ctx) => ctx.filter((_, i) => i !== idx))
  }

  // Compute mentioned items in current text; we treat a reference as any #word pattern (ids like 1 or 1.2)
  const combinedTextForMentions = `${title}\n${description}\n${rejection}`

  const mentionedPaths = useMemo(() => {
    const res = new Set<string>()
    for (const p of context) {
      if (combinedTextForMentions.includes(`@${p}`)) res.add(p)
    }
    return res
  }, [combinedTextForMentions, context])

  // Extract references mentioned in text (#ref) and sync with blockers list
  const mentionedRefs = useMemo(() => {
    const refs = new Set<string>()
    // Simple regex to capture #<alnum or dots and dashes>
    const re = /#([A-Za-z0-9_.-]+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(combinedTextForMentions)) !== null) {
      if (m[1]) refs.add(m[1])
    }
    return refs
  }, [combinedTextForMentions])

  // Keep context in sync with @ mentions: add on select via callback; also remove if no longer mentioned anywhere
  useEffect(() => {
    setContext((prev) => prev.filter((p) => combinedTextForMentions.includes(`@${p}`)))
  }, [combinedTextForMentions])

  const handleFileMentionSelected = (path: string) => {
    setContext((prev) => (prev.includes(path) ? prev : [...prev, path]))
  }

  const handleReferenceSelected = (ref: string) => {
    const canonical = normalizeDependency(ref)
    setBlockers((prev) => (prev.includes(canonical) ? prev : [...prev, canonical]))
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      onKeyDown={onKeyDown}
      className="space-y-4"
      aria-label={isCreate ? 'Create Feature' : 'Edit Feature'}
    >
      <div className="grid grid-cols-1 gap-3">
        <StatusControl status={status} onChange={setStatus} />
        <div className="flex items-center gap-3">
          <label
            htmlFor="feature-title"
            className="text-xs flex-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Title
          </label>
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
            color: 'var(--text-primary)',
          }}
          aria-invalid={!!error}
          aria-describedby={error ? 'feature-title-error' : undefined}
        />
        {error ? (
          <div
            id="feature-title-error"
            className="text-xs"
            style={{ color: 'var(--status-stuck-fg)' }}
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="feature-description"
            className="text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Description
          </label>
          <FileMentionsTextarea
            id="feature-description"
            rows={4}
            placeholder="Optional details or acceptance criteria. Tip: @ to reference files, # to reference tasks/features"
            value={description}
            onChange={setDescription}
            disabled={submitting}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60 resize-y max-h-64"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
            ariaLabel="Feature description"
            onFileMentionSelected={handleFileMentionSelected}
            onReferenceSelected={handleReferenceSelected}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="feature-rejection"
            className="text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Rejection Reason
          </label>
          <FileMentionsTextarea
            id="feature-rejection"
            rows={3}
            placeholder="Optional reason for rejection (leave blank to remove). Tip: @ files, # tasks/features"
            value={rejection}
            onChange={setRejection}
            disabled={submitting}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60 resize-y max-h-64"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
            ariaLabel="Feature rejection reason"
            onFileMentionSelected={handleFileMentionSelected}
            onReferenceSelected={handleReferenceSelected}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Context Files
          </label>
          <div
            className="flex flex-wrap items-start gap-2 border rounded-md min-h-[3rem] p-2"
            style={{ borderColor: 'var(--border-default)', background: 'var(--surface-raised)' }}
          >
            {context.map((p, idx) => (
              <ContextFileChip
                key={p}
                path={p}
                onRemove={() => removeContextAt(idx)}
                warn={!mentionedPaths.has(p)}
              />
            ))}
            <button
              type="button"
              onClick={() => setShowFileSelector(true)}
              className="chip chip--ok"
              title="Add context files"
            >
              <IconPlus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
          <div className="text-xs text-text-muted">
            Select any files across the project that provide useful context for this feature. Tip:
            type @ in description to quickly reference files.
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="feature-blockers"
            className="text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Blockers
          </label>
          <div
            id="feature-blockers"
            className="chips-list border rounded-md min-h-[3rem] p-2"
            style={{
              borderColor: 'var(--border-default)',
              background: 'var(--surface-raised)',
            }}
          >
            {blockers.map((dep, idx) => {
              return (
                <DependencyBullet
                  key={dep}
                  dependency={dep}
                  onRemove={() => removeBlockerAt(idx)}
                />
              )
            })}
            <button
              type="button"
              onClick={() => setShowSelector(true)}
              className="chip chip--ok"
              title="Add blocker"
            >
              <IconPlus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
          <div className="text-xs text-text-muted">
            Tip: Type # to quickly reference a task or feature; it will be added as a blocker
            automatically.
          </div>
        </div>
      </div>

      {!hideActions && (
        <div className="flex justify-between gap-2 pt-2">
          {onDelete && !isCreate ? (
            <Button
              className="btn-secondary"
              variant="danger"
              onClick={onDelete}
              disabled={submitting}
            >
              <div className="flex items-center gap-2">
                <IconDelete className="w-3 h-3" />
                Delete
              </div>
            </Button>
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
      )}

      {showSelector && (
        <Modal
          title="Select Blocker"
          onClose={() => setShowSelector(false)}
          isOpen={true}
          size="md"
        >
          <DependencySelector
            onConfirm={(deps) => {
              const newDeps = deps
                .map((d) => normalizeDependency(d))
                .filter((d) => !blockers.includes(d))
              setBlockers([...blockers, ...newDeps])
              setShowSelector(false)
            }}
            currentTaskId={taskId}
            currentFeatureId={featureId}
            existingDeps={blockers}
          />
        </Modal>
      )}

      {showFileSelector && (
        <Modal
          title="Select Context Files"
          onClose={() => setShowFileSelector(false)}
          isOpen={true}
          size="lg"
        >
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
