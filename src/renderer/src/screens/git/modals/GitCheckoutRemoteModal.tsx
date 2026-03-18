import { useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { gitService } from '@renderer/services/gitService'

export function GitCheckoutRemoteModal({
  projectId,
  remoteBranchName,
  onRequestClose,
  onSuccess,
}: {
  projectId: string
  remoteBranchName: string
  onRequestClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(remoteBranchName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const handleCheckout = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError(undefined)
    try {
      if (name.trim() === remoteBranchName) {
        const res = await gitService.checkout(projectId, remoteBranchName)
        if (res?.ok === false) throw new Error(res.error)
      } else {
        setError(
          'Custom local names for remote branches are currently unsupported. Please use the default name.',
        )
        setBusy(false)
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
      title={<div className="text-base font-semibold">Checkout Remote Branch</div>}
      panelClassName="w-[420px]"
    >
      <div className="flex flex-col gap-4">
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          Tracking remote branch: <span className="font-mono">{remoteBranchName}</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Local Branch Name
          </label>
          <input
            autoFocus
            className="input input-bordered w-full text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCheckout()
            }}
            disabled={busy}
          />
        </div>
        {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onRequestClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCheckout} disabled={busy || !name.trim()}>
            Checkout
          </Button>
        </div>
      </div>
    </Modal>
  )
}
