import React, { useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { gitService } from '@renderer/services/gitService'

export type GitStashModalProps = {
  projectId: string
  onRequestClose: () => void
  onSuccess: () => void
}

export function GitStashModal({ projectId, onRequestClose, onSuccess }: GitStashModalProps) {
  const [message, setMessage] = useState('')
  const [keepStagedChanges, setKeepStagedChanges] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const handleStash = async () => {
    if (!message.trim()) return
    setBusy(true)
    setError(undefined)
    try {
      const res = await gitService.addStash(projectId, { name: message.trim(), keepStagedChanges })
      if (!res) {
        setError('Failed to create stash (no result)')
        return
      }
      onSuccess()
      onRequestClose()
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onRequestClose}
      title={<div className="text-base font-semibold">Stash Changes</div>}
      panelClassName="w-[420px]"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Stash Message
          </label>
          <input
            autoFocus
            className="input input-bordered w-full text-sm"
            placeholder="e.g. WIP: feature implementation"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleStash()
            }}
            disabled={busy}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">
          <input
            type="checkbox"
            checked={keepStagedChanges}
            onChange={(e) => setKeepStagedChanges(e.target.checked)}
            disabled={busy}
          />
          Keep staged files (keep-index)
        </label>
        {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onRequestClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleStash} disabled={busy || !message.trim()}>
            Stash Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}
