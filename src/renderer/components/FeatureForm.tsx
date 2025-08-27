import React, { useEffect, useMemo, useRef, useState } from 'react'

export type FeatureFormValues = {
  title: string
  description?: string
  rejection?: string
}

type Props = {
  initialValues?: Partial<FeatureFormValues>
  onSubmit: (values: FeatureFormValues) => void | Promise<void>
  onCancel: () => void
  submitting?: boolean
  isCreate?: boolean
  titleRef?: React.RefObject<HTMLInputElement>
}

export function FeatureForm({ initialValues, onSubmit, onCancel, submitting = false, isCreate = false, titleRef }: Props) {
  const [title, setTitle] = useState<string>(initialValues?.title ?? '')
  const [description, setDescription] = useState<string>(initialValues?.description ?? '')
  const [rejection, setRejection] = useState<string>(initialValues?.rejection ?? '')
  const [error, setError] = useState<string | null>(null)

  const localTitleRef = useRef<HTMLInputElement>(null)
  const combinedTitleRef = titleRef ?? localTitleRef

  useEffect(() => {
    if (combinedTitleRef?.current) {
      combinedTitleRef.current.focus()
      combinedTitleRef.current.select?.()
    }
  }, [combinedTitleRef])

  const canSubmit = useMemo(() => title.trim().length > 0 && !submitting, [title, submitting])

  function validate(): boolean {
    if (!title.trim()) {
      setError('Title is required')
      return false
    }
    setError(null)
    return true
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!validate()) return
    const payload: FeatureFormValues = {
      title: title.trim(),
      description: description?.trim() || '',
      rejection: rejection?.trim() || undefined
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
    <form onSubmit={handleSubmit} onKeyDown={onKeyDown} className="space-y-4" aria-label={isCreate ? 'Create Feature' : 'Edit Feature'}>
      <div className="grid grid-cols-1 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="feature-title" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Title</label>
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
        </div>

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
      </div>

      <div className="flex justify-end gap-2 pt-2">
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
    </form>
  )
}

export default FeatureForm
