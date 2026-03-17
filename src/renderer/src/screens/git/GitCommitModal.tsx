import React, { useEffect, useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { gitService } from '@renderer/services/gitService'
import { useGit } from '@renderer/contexts/GitContext'

export type GitCommitModalProps = {
  projectId: string
  currentBranch: string
  onRequestClose: () => void
}

export default function GitCommitModal({ projectId, currentBranch, onRequestClose }: GitCommitModalProps) {
  const { unified } = useGit()

  const [busy, setBusy] = useState(false)
  const [opError, setOpError] = useState<string | undefined>(undefined)

  const [commitMsg, setCommitMsg] = useState('')
  const [pushNow, setPushNow] = useState(false)
  const [amend, setAmend] = useState(false)

  const [stagedCount, setStagedCount] = useState<number>(0)
  
  useEffect(() => {
    gitService.getLocalStatus(projectId).then(status => {
      setStagedCount(status?.staged?.length || 0)
    }).catch(console.error)
  }, [projectId])

  const doCommit = async () => {
    if (!amend && !commitMsg.trim()) {
      alert('Commit message required unless amending without message change')
      return
    }
    if (!amend && stagedCount === 0) {
      alert('No staged files to commit')
      return
    }

    setBusy(true)
    setOpError(undefined)
    try {
      const res = await gitService.commit(projectId, { 
        message: commitMsg.trim() || undefined, 
        amend 
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

  return (
    <Modal
      isOpen={true}
      onClose={onRequestClose}
      title={header}
      panelClassName='w-[500px]'
    >
      <div className='p-4 flex flex-col gap-4'>
        {opError && (
          <div className='text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-2 rounded'>
            {opError}
          </div>
        )}
        
        <div className='text-sm text-neutral-600 dark:text-neutral-400'>
          {stagedCount} staged file{stagedCount === 1 ? '' : 's'}
        </div>

        <textarea
          className='textarea textarea-bordered w-full min-h-[120px] text-sm resize-none'
          placeholder={amend ? 'Leave blank to keep existing commit message' : 'Commit message...'}
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) doCommit()
          }}
          autoFocus
        />

        <div className='flex flex-col gap-2 mt-2'>
          <label className='text-sm text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-2 cursor-pointer'>
            <input 
              type='checkbox' 
              checked={amend} 
              onChange={(e) => setAmend(e.target.checked)} 
              className='checkbox checkbox-sm rounded'
            />
            Amend last commit
          </label>
          <label className='text-sm text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-2 cursor-pointer'>
            <input 
              type='checkbox' 
              checked={pushNow} 
              onChange={(e) => setPushNow(e.target.checked)} 
              className='checkbox checkbox-sm rounded'
            />
            Push changes immediately to remote (origin)
          </label>
        </div>

        <div className='flex justify-end gap-2 mt-4'>
          <Button variant='secondary' onClick={onRequestClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant='primary'
            disabled={busy || (!amend && stagedCount === 0) || (!amend && !commitMsg.trim())}
            onClick={doCommit}
          >
            {busy ? 'Committing...' : 'Commit'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
