import { useEffect, useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { gitService } from '@renderer/services/gitService'
import { useGit } from '@renderer/contexts/GitContext'

export type GitCommitModalProps = {
  projectId: string
  currentBranch: string
  onRequestClose: () => void
  onAfterCommit?: () => void
}

export default function GitCommitModal({
  projectId,
  currentBranch,
  onRequestClose,
  onAfterCommit,
}: GitCommitModalProps) {
  const { unified } = useGit()

  const [busy, setBusy] = useState(false)
  const [opError, setOpError] = useState<string | undefined>(undefined)

  const [commitMsg, setCommitMsg] = useState('')
  const [pushNow, setPushNow] = useState(false)
  const [amend, setAmend] = useState(false)

  const [stagedCount, setStagedCount] = useState<number>(0)

  useEffect(() => {
    gitService
      .getLocalStatus(projectId)
      .then((st) => setStagedCount(st.staged.length))
      .catch(console.error)
  }, [projectId])

  const onCommit = async () => {
    setBusy(true)
    setOpError(undefined)
    try {
      const res = await gitService.commit(projectId, {
        message: commitMsg.trim() || undefined,
        amend,
      })
      if (!res?.ok) {
        setOpError(res?.error || 'Commit failed')
        return
      }
      if (pushNow) {
        const pr = await gitService.push(projectId, 'origin', currentBranch)
        if (!pr?.ok) {
          setOpError(pr?.error || 'Push failed')
          return
        }
      }
      // refresh unified panel
      await unified.reload(projectId)
      onRequestClose()
      if (onAfterCommit) onAfterCommit()
    } catch (e: any) {
      setOpError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const title = (
    <div className="flex flex-col gap-1.5">
      <div className="text-base font-semibold">Prepare commit</div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400">
        Working tree · branch {currentBranch}
      </div>
    </div>
  )

  const footer = (
    <div className="flex items-center justify-between gap-2 w-full">
      <div className="text-xs text-neutral-600 dark:text-neutral-400">
        {stagedCount} file(s) staged
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onRequestClose} variant="secondary" disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={onCommit}
          loading={busy}
          disabled={busy || (!amend && stagedCount === 0) || (!amend && !commitMsg.trim())}
        >
          {amend ? 'Amend Commit' : 'Commit'}
        </Button>
      </div>
    </div>
  )

  return (
    <Modal isOpen onClose={onRequestClose} title={title} footer={footer} size="md">
      <div className="flex flex-col gap-4">
        {opError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded border border-red-200 dark:border-red-800/30 whitespace-pre-wrap">
            {opError}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold">Commit message</label>
          <textarea
            className="w-full text-sm rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent p-2 resize-none h-24 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            placeholder="Describe your changes..."
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            disabled={busy}
            autoFocus
          />
        </div>

        <div className="flex items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pushNow}
              onChange={(e) => setPushNow(e.target.checked)}
              disabled={busy}
            />
            <span>Commit & Push</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={amend}
              onChange={(e) => setAmend(e.target.checked)}
              disabled={busy}
            />
            <span>Amend previous commit</span>
          </label>
        </div>
      </div>
    </Modal>
  )
}
