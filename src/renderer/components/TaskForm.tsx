import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Status } from 'src/types/tasks'

export type TaskFormValues = {
  title: string
  status: Status
  description?: string
}

type Props = {
  id: string
  initialValues?: Partial<TaskFormValues>
  onSubmit: (values: TaskFormValues) => void | Promise<void>
  onCancel: () => void
  submitting?: boolean
  isCreate?: boolean
  titleRef?: React.RefObject<HTMLInputElement>
  onDelete?: () => void
}

const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
  { value: '-', label: 'Pending' },
  { value: '~', label: 'In Progress' },
  { value: '+', label: 'Done' },
  { value: '?', label: 'Blocked' },
  { value: '=', label: 'Deferred' },
]

export function TaskForm({ id, initialValues, onSubmit, onCancel, submitting = false, isCreate = false, titleRef, onDelete }: Props) {
  const [title, setTitle] = useState<string>(initialValues?.title ?? '')
  const [status, setStatus] = useState<Status>(initialValues?.status ?? '-')
  const [description, setDescription] = useState<string>(initialValues?.description ?? '')
  const [errors, setErrors] = useState<{ id?: string; title?: string }>({})

  const localTitleRef = useRef<HTMLInputElement>(null)
  const combinedTitleRef = titleRef ?? localTitleRef

  useEffect(() => {
    if (combinedTitleRef?.current) {
      combinedTitleRef.current.focus()
      combinedTitleRef.current.select?.()
    }
  }, [combinedTitleRef])

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
    const payload: TaskFormValues = {
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
    <form onSubmit={handleSubmit} onKeyDown={onKeyDown} className="space-y-4" aria-label={isCreate ? 'Create Task' : 'Edit Task'}>
      <div className="grid grid-cols-1 gap-3">
        {!isCreate && <div className="flex flex-col gap-1">
          <label htmlFor="task-id" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Task ID</label>
          <input
            id="task-id"
            type="number"
            inputMode="numeric"
            value={id}
            disabled={true}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)'
            }}
          />
        </div>}

        <div className="flex flex-col gap-1">
          <label htmlFor="task-title" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Title</label>
          <input
            id="task-title"
            ref={combinedTitleRef}
            type="text"
            placeholder="Give your task a clear title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            style={{
              background: 'var(--surface-raised)',
              borderColor: errors.title ? 'var(--status-stuck-soft-border)' : 'var(--border-default)',
              color: 'var(--text-primary)'
            }}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'task-title-error' : undefined}
          />
          {errors.title ? (
            <div id="task-title-error" className="text-xs" style={{ color: 'var(--status-stuck-fg)' }}>{errors.title}</div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="task-status" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Status</label>
          <select
            id="task-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            disabled={submitting}
            className="ui-select w-full"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="task-description" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Description</label>
          <textarea
            id="task-description"
            rows={4}
            placeholder="Optional description or details"
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
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onDelete && (
          <button
            type="button"
            className="btn-destructive mr-auto"
            onClick={onDelete}
            disabled={submitting}
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
          {isCreate ? 'Create Task' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
export default TaskForm
