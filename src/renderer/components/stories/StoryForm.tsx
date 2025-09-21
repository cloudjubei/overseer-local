import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Status } from 'thefactory-tools'
import StatusControl from './StatusControl'

export type StoryFormValues = {
  title: string
  status: Status
  description?: string
}

type Props = {
  id: string
  initialValues?: Partial<StoryFormValues>
  onSubmit: (values: StoryFormValues) => void | Promise<void>
  onCancel: () => void
  submitting?: boolean
  isCreate?: boolean
  titleRef?: React.RefObject<HTMLInputElement>
  onDelete?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export default function StoryForm({
  id,
  initialValues,
  onSubmit,
  onCancel,
  submitting = false,
  isCreate = false,
  titleRef,
  onDelete,
  onDirtyChange,
}: Props) {
  const [title, setTitle] = useState<string>(initialValues?.title ?? '')
  const [status, setStatus] = useState<Status>(initialValues?.status ?? '-')
  const [description, setDescription] = useState<string>(initialValues?.description ?? '')
  const [errors, setErrors] = useState<{ id?: string; title?: string }>({})

  const localTitleRef = useRef<HTMLInputElement>(null)
  const combinedTitleRef = titleRef ?? localTitleRef

  // Baseline snapshot of initial values for dirty tracking
  const initialSnapshotRef = useRef<{ title: string; status: Status; description: string } | null>(
    null,
  )
  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = {
      title: initialValues?.title ?? '',
      status: initialValues?.status ?? '-',
      description: initialValues?.description ?? '',
    }
  }

  useEffect(() => {
    if (combinedTitleRef?.current) {
      combinedTitleRef.current.focus()
      combinedTitleRef.current.select?.()
    }
  }, [combinedTitleRef])

  // Dirty state calculation
  useEffect(() => {
    const current = { title, status, description }
    const baseline = initialSnapshotRef.current!
    const dirty =
      current.title !== baseline.title ||
      current.status !== baseline.status ||
      current.description !== baseline.description
    onDirtyChange?.(dirty)
  }, [title, status, description, onDirtyChange])

  const canSubmit = useMemo(() => {
    const hasTitle = title.trim().length > 0
    return hasTitle && !submitting
  }, [title, submitting])

  function validate(): boolean {
    const next: { id?: string; title?: string } = {}
    if (!title.trim()) next.title = 'Title is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!validate()) return
    const payload: StoryFormValues = {
      title: title.trim(),
      status,
      description: description?.trim() || '',
    }
    await onSubmit(payload)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
      e.preventDefault()
      if (canSubmit) handleSubmit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={onKeyDown}
      className="space-y-4"
      aria-label={isCreate ? 'Create Story' : 'Edit Story'}
    >
      <div className="grid grid-cols-1 gap-3">
        <StatusControl status={status} onChange={setStatus} />
        <div className="flex flex-col gap-1">
          <label
            htmlFor="story-title"
            className="text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Title
          </label>
          <input
            id="story-title"
            ref={combinedTitleRef}
            type="text"
            placeholder="Give your story a clear title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            style={{
              background: 'var(--surface-raised)',
              borderColor: errors.title
                ? 'var(--status-stuck-soft-border)'
                : 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'story-title-error' : undefined}
          />
          {errors.title ? (
            <div
              id="story-title-error"
              className="text-xs"
              style={{ color: 'var(--status-stuck-fg)' }}
            >
              {errors.title}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="story-description"
            className="text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Description
          </label>
          <textarea
            id="story-description"
            rows={4}
            placeholder="Optional description or details"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60 resize-y max-h-64"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={submitting}
            className="btn"
            style={{
              background: 'var(--status-stuck-bg)',
              color: 'var(--status-stuck-fg)',
            }}
          >
            Delete
          </button>
        )}
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
          {isCreate ? 'Create Story' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
