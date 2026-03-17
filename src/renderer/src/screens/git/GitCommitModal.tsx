import React from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import Tooltip from '@renderer/components/ui/Tooltip'
import { gitService } from '@renderer/services/gitService'
import { IconMaximize, IconMinimize } from '@renderer/components/ui/icons/Icons'
import { useGit } from '@renderer/contexts/GitContext'
import { GitLocalChanges, GitLocalChangesRef, LocalStatus } from './GitLocalChanges'

export type GitCommitModalProps = {
  projectId: string
  currentBranch: string
  onRequestClose: () => void
}

export default function GitCommitModal({ projectId, currentBranch, onRequestClose }: GitCommitModalProps) {
  const { unified } = useGit()

  // Maximize/minimize
  const [maximized, setMaximized] = React.useState(false)

  // Status from local changes panel (used for commit actions)
  const [status, setStatus] = React.useState<LocalStatus>({ staged: [], unstaged: [], untracked: [] })
  const [busy, setBusy] = React.useState(false)
  const [opError, setOpError] = React.useState<string | undefined>(undefined)

  const localChangesRef = React.useRef<GitLocalChangesRef | null>(null)

  const stagedCount = status.staged?.length || 0

  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [commitMsg, setCommitMsg] = React.useState('')
  const [pushNow, setPushNow] = React.useState(true)

  const doCommit = async () => {
    if (!commitMsg.trim()) {
      alert('Commit message required')
      return
    }
    if (stagedCount === 0) {
      alert('No staged files to commit')
      return
    }

    setBusy(true)
    setOpError(undefined)
    try {
      const res = await gitService.commit(projectId, { message: commitMsg })
      if (!res?.ok) {
        setOpError(res?.error || 'Commit failed')
        return
      }
      if (pushNow) {
        const pr = await gitService.push(projectId, { remote: 'origin', branch: currentBranch })
        if (!pr?.ok) {
          setOpError(pr?.error || 'Push failed')
          return
        }
      }
      // refresh unified and local panel
      await unified.reload(projectId)
      await localChangesRef.current?.load()
      onRequestClose()
    } catch (e: any) {
      setOpError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <div className='flex flex-col gap-1.5'>
      <div className='text-base font-semibold'>Prepare commit</div>
      <div className='text-xs text-neutral-600 dark:text-neutral-400'>Working tree · branch {currentBranch}</div>
    </div>
  )

  const headerActions = (
    <div className='flex items-center gap-2'>
      <Tooltip content={maximized ? 'minimize' : 'maximize'} placement='bottom'>
        <button
          className='group inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800'
          aria-label={maximized ? 'Minimize' : 'Maximize'}
          title={maximized ? 'Minimize' : 'Maximize'}
          onClick={() => setMaximized((v) => !v)}
        >
          {maximized ? <IconMinimize className='w-4 h-4' /> : <IconMaximize className='w-4 h-4' />}
        </button>
      </Tooltip>
    </div>
  )

  return (
    <Modal
      open
      onRequestClose={onRequestClose}
      title={header}
      headerActions={headerActions}
      className={maximized ? 'w-[98vw] h-[92vh]' : 'w-[980px] h-[720px]'}
    >
      <div className='flex flex-col h-full min-h-0'>
        {/* Main split area */}
        <div className='flex-1 min-h-0'>
          <GitLocalChanges
            ref={localChangesRef}
            projectId={projectId}
            className='h-full'
            onStatusChange={(s) => setStatus(s)}
            onBusyChange={(b) => setBusy(b)}
            onErrorChange={(e) => setOpError(e)}
          />
        </div>

        {/* Footer commit controls */}
        <div className='border-t border-neutral-200 dark:border-neutral-800 p-3 flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            {opError ? <div className='text-xs text-red-700 dark:text-red-300 truncate'>{opError}</div> : null}
            <div className='text-xs text-neutral-600 dark:text-neutral-400'>
              {stagedCount} staged file{stagedCount === 1 ? '' : 's'}
            </div>
          </div>

          <div className='flex items-center gap-2 min-w-0 flex-1 justify-end'>
            <label className='text-xs text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-2'>
              <input type='checkbox' checked={pushNow} onChange={(e) => setPushNow(e.target.checked)} />
              Push after commit
            </label>

            <input
              className='input input-bordered text-sm flex-1 min-w-[280px]'
              placeholder='Commit message'
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) setConfirmOpen(true)
              }}
            />

            <Button
              variant='primary'
              disabled={busy || stagedCount === 0 || !commitMsg.trim()}
              onClick={() => setConfirmOpen(true)}
            >
              Commit
            </Button>
          </div>
        </div>

        {/* confirm */}
        {confirmOpen ? (
          <div className='absolute inset-0 flex items-center justify-center bg-black/30'>
            <div className='bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 w-[420px]'>
              <div className='text-sm font-semibold mb-2'>Confirm commit</div>
              <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-4'>
                Commit {stagedCount} staged file{stagedCount === 1 ? '' : 's'} to <span className='font-mono'>{currentBranch}</span>?
              </div>
              <div className='flex justify-end gap-2'>
                <Button variant='secondary' onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant='primary'
                  disabled={busy || stagedCount === 0 || !commitMsg.trim()}
                  onClick={async () => {
                    setConfirmOpen(false)
                    await doCommit()
                  }}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
