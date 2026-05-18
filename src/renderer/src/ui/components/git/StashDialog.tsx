import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useGit } from '@core/contexts/GitContext'
import { Alert, Button, Field, Input, Modal } from 'thefactory-ui/web'

export type StashDialogProps = {
  isOpen: boolean
  onClose: () => void
}

export default function StashDialog({ isOpen, onClose }: StashDialogProps) {
  const { stash } = useGit()
  const [message, setMessage] = useState('')
  const [keepIndex, setKeepIndex] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = message.trim()
  // An empty stash message is allowed by git — it'll auto-generate one.
  const canSubmit = !submitting

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await stash({
        ...(trimmed.length > 0 ? { message: trimmed } : {}),
        ...(keepIndex ? { keepIndex: true } : {}),
      })
      setMessage('')
      setKeepIndex(false)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stash')
    } finally {
      setSubmitting(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void onSubmit(e as unknown as FormEvent)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Stash changes">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Message (optional)">
          <Input
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="e.g. WIP: feature implementation"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={keepIndex}
            onChange={(e) => setKeepIndex(e.target.checked)}
          />
          Keep staged files (--keep-index)
        </label>
        <div className="flex justify-end">
          <Button type="submit" loading={submitting} disabled={!canSubmit}>
            Stash
          </Button>
        </div>
      </form>
    </Modal>
  )
}
