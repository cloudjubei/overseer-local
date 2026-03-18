import { useState } from 'react'
import { GitUnifiedBranch } from 'thefactory-tools'
import { IconRefresh } from '../../../components/ui/icons/IconRefresh'
import { IconBranch } from '../../../components/ui/icons/IconBranch'
import { IconFastMerge } from '../../../components/ui/icons/IconFastMerge'
import { IconCommit } from '../../../components/ui/icons/IconCommit'
import { IconPullRequest } from '../../../components/ui/icons/IconPullRequest'
import { IconDoubleUp } from '../../../components/ui/icons/IconDoubleUp'
import { IconArchive } from '../../../components/ui/icons/IconArchive'
import { IconDelete, IconArrowDown } from '../../../components/ui/icons/Icons'
import { IconChevronDown } from '../../../components/ui/icons/IconChevronDown'
import { useProjectContext } from '../../../contexts/ProjectContext'
import { useGit } from '../../../contexts/GitContext'
import { gitService } from '../../../services/gitService'
import { getPRUrl } from '../../../utils/gitPRUrl'
import GitCommitModal from '../modals/GitCommitModal'
import { GitCreateBranchModal } from '../modals/GitCreateBranchModal'
import { GitStashModal } from '../modals/GitStashModal'
import GitActionButton from './GitActionButton'

export const ACTIONS_RAIL_WIDTH = 60

export function GitActionsPanel({
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
  onSwitchToBranch: (b: GitUnifiedBranch) => void
  onOpenMerge: (baseRef: string, headRef: string) => void
  currentBranchName?: string
  onStashAppliedOrDeleted?: () => void
}) {
  const { activeProjectId, activeProject } = useProjectContext()
  const { unified } = useGit()

  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [createBranchModalOpen, setCreateBranchModalOpen] = useState(false)
  const [stashModalOpen, setStashModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const canSwitch = isClean === true && !checkingClean

  const pushCount = selectedBranch?.ahead ?? 0
  const canPush = (pushCount > 0 || !selectedBranch?.isRemote) && !busy

  // "Branch" (create) is only meaningful when a local branch is active/selected
  const canCreateBranch = !!selectedBranch?.isLocal && !busy

  const canCreatePR =
    selectedBranch && selectedBranch.name !== 'main' && !!activeProject?.repo_url && !busy

  const handlePull = async () => {
    if (!activeProjectId || !selectedBranch || busy) return
    setBusy(true)
    try {
      const res = await gitService.pull(
        activeProjectId,
        selectedBranch.upstreamRemote,
        selectedBranch.name,
      )
      if (res?.ok === false) alert(res.error || 'Failed to pull')
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
      const res = await gitService.push(
        activeProjectId,
        selectedBranch.upstreamRemote,
        selectedBranch.name,
      )
      if (res?.ok === false) alert(res.error || 'Failed to push')
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
      if (res?.ok === false) alert(res.error || 'Failed to fetch')
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
        if (window.confirm('Stash applied successfully. Do you want to drop it now?')) {
          const dropRes = await gitService.removeStash(activeProjectId, {
            stashRef: selectedStashRef,
          })
          if (!dropRes?.ok) alert(`Drop stash failed: ${dropRes?.error || 'Unknown error'}`)
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
      if (!res?.ok) alert(`Drop stash failed: ${res?.error || 'Unknown error'}`)
      else onStashAppliedOrDeleted?.()
      onRefresh()
    } catch (e: any) {
      alert(`Drop stash failed: ${e?.message}`)
    } finally {
      setBusy(false)
    }
  }

  const handleCreatePR = () => {
    if (!activeProject?.repo_url || !selectedBranch) return
    const url = getPRUrl(activeProject.repo_url, selectedBranch.name, 'main')
    if (url) {
      window.open(url, '_blank')
    } else {
      alert('Could not determine PR URL for ' + activeProject.repo_url)
    }
  }

  return (
    <div
      className="shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex flex-col min-h-0 items-center py-2 overflow-x-hidden"
      style={{ width: ACTIONS_RAIL_WIDTH }}
    >
      <div className="flex flex-col gap-2 items-center w-full px-2 overflow-y-auto overflow-x-hidden hide-scrollbar">
        {/* Always-visible */}
        <GitActionButton
          icon={<IconRefresh className="w-5 h-5" />}
          label="Refresh"
          onClick={onRefresh}
          disabled={busy || checkingClean}
          tooltip={
            checkingClean
              ? 'Checking working tree…'
              : `Working tree: ${isClean === true ? 'clean' : isClean === false ? 'dirty' : '—'}${changedCount > 0 ? ` • ${changedCount} changed` : ''}`
          }
        />

        {selectedBranch && (
          <>
            {/* Commit: only if local branch is selected */}
            <GitActionButton
              icon={<IconCommit className="w-5 h-5" />}
              label="Commit"
              onClick={() => setCommitModalOpen(true)}
              disabled={busy || !selectedBranch.isLocal || !!isClean}
              tooltip={
                !selectedBranch.isLocal
                  ? 'Select a local branch to commit'
                  : isClean
                    ? 'No changes to commit'
                    : 'Commit staged/unstaged changes'
              }
            />

            {/* Pull / Push only for local branches */}
            {selectedBranch.isLocal && (
              <>
                <GitActionButton
                  icon={<IconArrowDown className="w-5 h-5" />}
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
                  tooltip={canPush ? `Push ${pushCount} commit(s)` : 'Nothing to push'}
                />
              </>
            )}

            {/* Fetch always available */}
            <GitActionButton
              icon={<IconChevronDown className="w-5 h-5" />}
              label="Fetch"
              onClick={handleFetch}
              disabled={busy}
              tooltip="Fetch from remote"
            />

            {/* Branch: only when a local branch is active */}
            <GitActionButton
              icon={<IconBranch className="w-5 h-5" />}
              label="Branch"
              onClick={() => setCreateBranchModalOpen(true)}
              disabled={!canCreateBranch}
              tooltip={
                canCreateBranch
                  ? 'Create new branch from here'
                  : 'Select a local branch to create from'
              }
            />

            {/* Create PR */}
            <GitActionButton
              icon={<IconPullRequest className="w-5 h-5" />}
              label="PR"
              onClick={handleCreatePR}
              disabled={!canCreatePR}
              tooltip={
                canCreatePR
                  ? `Create Pull Request for ${selectedBranch.name}`
                  : 'Requires a branch (other than main) and a remote repo URL'
              }
            />

            {/* Switch + Merge: only if the selected branch is NOT the current one */}
            {!selectedBranch.current && (
              <>
                <GitActionButton
                  icon={<IconBranch className="w-5 h-5" />}
                  label="Switch"
                  onClick={() => onSwitchToBranch(selectedBranch)}
                  disabled={busy || !canSwitch}
                  tooltip={
                    canSwitch ? 'Switch to this branch' : 'Working tree must be clean to switch'
                  }
                />
                {selectedBranch.isLocal && (
                  <GitActionButton
                    icon={<IconFastMerge className="w-5 h-5" />}
                    label="Merge"
                    onClick={() => onOpenMerge(currentBranchName || 'main', selectedBranch.name)}
                    disabled={busy || !currentBranchName}
                    tooltip={
                      currentBranchName
                        ? `Merge ${selectedBranch.name} → ${currentBranchName}`
                        : 'Current branch unknown'
                    }
                  />
                )}
              </>
            )}

            {/* Stash: local branches only */}
            <GitActionButton
              icon={<IconArchive className="w-5 h-5" />}
              label="Stash"
              onClick={() => setStashModalOpen(true)}
              disabled={busy || !selectedBranch.isLocal || !!isClean}
              tooltip={
                !selectedBranch.isLocal
                  ? 'Select a local branch to stash'
                  : isClean
                    ? 'No changes to stash'
                    : 'Stash current changes'
              }
            />
          </>
        )}

        {selectedStashRef && (
          <>
            <GitActionButton
              icon={<IconCommit className="w-5 h-5" />}
              label="Apply"
              onClick={handleApplyStash}
              disabled={busy}
              tooltip="Apply this stash"
            />
            <GitActionButton
              icon={<IconDelete className="w-5 h-5 text-red-600 dark:text-red-400" />}
              label="Drop"
              onClick={handleDeleteStash}
              disabled={busy}
              tooltip="Drop this stash"
            />
          </>
        )}
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
