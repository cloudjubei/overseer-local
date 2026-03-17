import React, { useState } from 'react'
import { GitUnifiedBranch } from 'thefactory-tools'

import Tooltip from '../../components/ui/Tooltip'
import { IconRefresh } from '../../components/ui/icons/IconRefresh'
import { IconBranch } from '../../components/ui/icons/IconBranch'
import { IconFastMerge } from '../../components/ui/icons/IconFastMerge'
import { IconCommit } from '../../components/ui/icons/IconCommit'
import { IconPullRequest } from '../../components/ui/icons/IconPullRequest'
import { IconDoubleUp } from '../../components/ui/icons/IconDoubleUp'
import { IconArchive } from '../../components/ui/icons/IconArchive'
import { IconDelete } from '../../components/ui/icons/Icons'
import { IconChevronDown } from '../../components/ui/icons/IconChevronDown'

import { useProjectContext } from '../../contexts/ProjectContext'
import { useGit } from '../../contexts/GitContext'
import { gitService } from '../../services/gitService'

import GitCommitModal from './GitCommitModal'
import { GitCreateBranchModal } from './GitCreateBranchModal'
import { GitStashModal } from './GitStashModal'

export const ACTIONS_RAIL_WIDTH = 80

function GitActionButton({
  icon,
  label,
  onClick,
  disabled,
  tooltip,
  badge,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  tooltip?: string
  badge?: number
}) {
  const btn = (
    <button
      className={
        'w-[64px] h-[64px] shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-800 ' +
        'bg-white dark:bg-neutral-950/30 ' +
        'hover:bg-neutral-50 dark:hover:bg-neutral-900/40 ' +
        'active:scale-[0.98] transition ' +
        'flex flex-col items-center justify-center gap-1 relative ' +
        (disabled ? 'opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-neutral-950/30' : '')
      }
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <div className="w-5 h-5 text-neutral-700 dark:text-neutral-200 flex items-center justify-center">
        {icon}
      </div>
      <div className="text-[10px] leading-3 text-neutral-700 dark:text-neutral-300 text-center px-1">
        {label}
      </div>
      {badge !== undefined && badge > 0 && (
        <div className="absolute top-1 right-1 bg-blue-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-md leading-none shadow-sm min-w-[16px] text-center">
          {badge}
        </div>
      )}
    </button>
  )

  return tooltip ? <Tooltip content={tooltip}>{btn}</Tooltip> : btn
}

export function GitRightActionsPanel({
  selectedBranch,
  selectedStashRef,
  checkingClean,
  isClean,
  changedCount,
  onRefresh,
  onSwitchToBranch,
  onOpenMerge,
  currentBranchName,
  onStashAppliedOrDeleted,
}: {
  selectedBranch?: GitUnifiedBranch
  selectedStashRef?: string
  checkingClean: boolean
  isClean?: boolean
  changedCount: number
  onRefresh: () => void
  onSwitchToBranch: (name: string) => void
  onOpenMerge: (baseRef: string, headRef: string) => void
  currentBranchName?: string
  onStashAppliedOrDeleted?: () => void
}) {
  const { activeProjectId } = useProjectContext()
  const { unified } = useGit()

  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [createBranchModalOpen, setCreateBranchModalOpen] = useState(false)
  const [stashModalOpen, setStashModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const canSwitch = isClean === true && !checkingClean

  // Push: enabled only if local commits not pushed to remote; show badge with count.
  const pushCount = selectedBranch?.ahead || 0
  const canPush = (pushCount > 0 || !selectedBranch?.isRemote) && !busy

  const handlePull = async () => {
    if (!activeProjectId || !selectedBranch || busy) return
    setBusy(true)
    try {
      const res = await gitService.pull(activeProjectId, selectedBranch.upstreamRemote, selectedBranch.name)
      if (res?.ok === false) {
        alert(res.error || 'Failed to pull')
      }
      onRefresh()
      await unified.reload(activeProjectId)
    } catch (e: any) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const handlePush = async () => {
    if (!activeProjectId || !selectedBranch || busy) return
    setBusy(true)
    try {
      const res = await gitService.push(activeProjectId, selectedBranch.upstreamRemote, selectedBranch.name)
      if (res?.ok === false) {
        alert(res.error || 'Failed to push')
      }
      onRefresh()
      await unified.reload(activeProjectId)
    } catch (e: any) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleFetch = async () => {
    if (!activeProjectId || busy) return
    setBusy(true)
    try {
      const res = await gitService.fetch(activeProjectId)
      if (res?.ok === false) {
        alert(res.error || 'Failed to fetch')
      }
      onRefresh()
      await unified.reload(activeProjectId)
    } catch (e: any) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleApplyStash = async () => {
    if (!activeProjectId || !selectedStashRef || busy) return
    setBusy(true)
    try {
      const res = await gitService.applyStash(activeProjectId, { stashRef: selectedStashRef })
      if (!res?.ok) {
        alert(`Apply stash failed: ${res?.error || 'Unknown error'}`)
      } else {
        if (window.confirm(`Stash applied successfully. Do you want to drop it now?`)) {
          const dropRes = await gitService.removeStash(activeProjectId, { stashRef: selectedStashRef })
          if (!dropRes?.ok) {
            alert(`Drop stash failed: ${dropRes?.error || 'Unknown error'}`)
          }
        }
        onStashAppliedOrDeleted?.()
      }
      onRefresh()
    } catch (e: any) {
      alert(`Apply stash failed: ${e?.message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteStash = async () => {
    if (!activeProjectId || !selectedStashRef || busy) return
    if (!window.confirm(`Are you sure you want to drop stash ${selectedStashRef}?`)) return
    setBusy(true)
    try {
      const res = await gitService.removeStash(activeProjectId, { stashRef: selectedStashRef })
      if (!res?.ok) {
        alert(`Drop stash failed: ${res?.error || 'Unknown error'}`)
      } else {
        onStashAppliedOrDeleted?.()
      }
      onRefresh()
    } catch (e: any) {
      alert(`Drop stash failed: ${e?.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex flex-col min-h-0 items-center py-2 overflow-x-hidden"
      style={{ width: ACTIONS_RAIL_WIDTH }}
    >
      <div className="flex flex-col gap-2 items-center w-full px-2 overflow-y-auto overflow-x-hidden hide-scrollbar">
        <GitActionButton
          icon={<IconRefresh className="w-5 h-5" />}
          label="Refresh"
          onClick={onRefresh}
          disabled={busy || checkingClean}
          tooltip={checkingClean ? 'Checking working tree…' : `Working tree: ${isClean === true ? 'clean' : isClean === false ? 'dirty' : '—'}${changedCount > 0 ? ` • ${changedCount} changed` : ''}`}
        />

        {selectedBranch ? (
          <>
            <GitActionButton
              icon={<IconCommit className="w-5 h-5" />}
              label="Commit"
              onClick={() => setCommitModalOpen(true)}
              disabled={busy || isClean}
              tooltip={isClean ? "No changes to commit" : "Commit changes"}
            />
            <GitActionButton
              icon={<IconPullRequest className="w-5 h-5" />}
              label="Pull"
              onClick={handlePull}
              disabled={busy}
              tooltip="Pull from remote"
            />
            <GitActionButton
              icon={<IconDoubleUp className="w-5 h-5" />}
              label="Push"
              onClick={handlePush}
              disabled={!canPush}
              badge={pushCount}
              tooltip={canPush ? `Push ${pushCount} commit(s)` : 'No outgoing commits'}
            />
            <GitActionButton
              icon={<IconChevronDown className="w-5 h-5" />}
              label="Fetch"
              onClick={handleFetch}
              disabled={busy}
              tooltip="Fetch from remote"
            />
            <GitActionButton
              icon={<IconBranch className="w-5 h-5" />}
              label="Branch"
              onClick={() => setCreateBranchModalOpen(true)}
              disabled={busy}
              tooltip="Create new branch"
            />
            
            {/* Merge: visible only when selected branch is not the active/current branch */}
            {!selectedBranch.current && (
              <>
                <GitActionButton
                  icon={<IconBranch className="w-5 h-5" />}
                  label="Switch"
                  onClick={() => onSwitchToBranch(selectedBranch.name)}
                  disabled={busy || !canSwitch}
                  tooltip={canSwitch ? 'Switch to branch' : 'Working tree must be clean to switch'}
                />
                <GitActionButton
                  icon={<IconFastMerge className="w-5 h-5" />}
                  label="Merge"
                  onClick={() => onOpenMerge(currentBranchName || 'main', selectedBranch.name)}
                  disabled={busy || !currentBranchName}
                  tooltip={currentBranchName ? `Merge ${selectedBranch.name} into ${currentBranchName}` : 'Current branch unknown'}
                />
              </>
            )}

            <GitActionButton
              icon={<IconArchive className="w-5 h-5" />}
              label="Stash"
              onClick={() => setStashModalOpen(true)}
              disabled={busy || isClean}
              tooltip={isClean ? "No changes to stash" : "Stash changes"}
            />
          </>
        ) : null}

        {selectedStashRef ? (
          <>
            <GitActionButton
              icon={<IconCommit className="w-5 h-5" />}
              label="Apply"
              onClick={handleApplyStash}
              disabled={busy}
              tooltip="Apply Stash"
            />
            <GitActionButton
              icon={<IconDelete className="w-5 h-5 text-red-600 dark:text-red-400" />}
              label="Drop"
              onClick={handleDeleteStash}
              disabled={busy}
              tooltip="Drop Stash"
            />
          </>
        ) : null}
      </div>

      {/* Modals */}
      {commitModalOpen && activeProjectId && selectedBranch && (
        <GitCommitModal
          projectId={activeProjectId}
          currentBranch={selectedBranch.name}
          onRequestClose={() => {
            setCommitModalOpen(false)
            onRefresh()
          }}
        />
      )}
      
      {createBranchModalOpen && activeProjectId && selectedBranch && (
        <GitCreateBranchModal
          projectId={activeProjectId}
          currentBranch={selectedBranch.name}
          onRequestClose={() => setCreateBranchModalOpen(false)}
          onSuccess={() => {
            onRefresh()
            unified.reload(activeProjectId)
          }}
        />
      )}
      
      {stashModalOpen && activeProjectId && (
        <GitStashModal
          projectId={activeProjectId}
          onRequestClose={() => setStashModalOpen(false)}
          onSuccess={() => {
            onRefresh()
            unified.reload(activeProjectId)
            onStashAppliedOrDeleted?.()
          }}
        />
      )}
    </div>
  )
}
