import React, { useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { gitService } from '@renderer/services/gitService'

export type GitCreateBranchModalProps = {
  projectId: string
  currentBranch?: string
  onRequestClose: () => void
  onSuccess: () => void
}

export function GitCreateBranchModal({
  projectId,
  currentBranch,
  onRequestClose,
  onSuccess,
}: GitCreateBranchModalProps) {
  const [name, setName] = useState('')
  const [checkoutAfter, setCheckoutAfter] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const handleCreate = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError(undefined)
    try {
      const res = await gitService.createBranch(projectId, name.trim(), checkoutAfter)
      if (res?.ok === false) {
        setError(res.error || 'Failed to create branch')
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
      title={<div className="text-base font-semibold">Create Branch</div>}
      panelClassName="w-[420px]"
    >
      <div className="flex flex-col gap-4">
        {currentBranch && (
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Base branch: <span className="font-mono">{currentBranch}</span>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Branch Name
          </label>
          <input
            autoFocus
            className="input input-bordered w-full text-sm"
            placeholder="e.g. feature/my-new-idea"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
            disabled={busy}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">
          <input
            type="checkbox"
            checked={checkoutAfter}
            onChange={(e) => setCheckoutAfter(e.target.checked)}
            disabled={busy}
          />
          Checkout after create
        </label>
        {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onRequestClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={busy || !name.trim()}>
            Create Branch
          </Button>
        </div>
      </div>
    </Modal>
  )
}
