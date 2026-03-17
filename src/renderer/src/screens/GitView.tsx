import React from 'react'
import { gitService } from '@renderer/services/gitService'
import { GitUnifiedBranch } from 'thefactory-tools'

import { useProjectContext } from '../contexts/ProjectContext'
import { useGit } from '../contexts/GitContext'
import { useNavigator } from '../navigation/Navigator'

import GitCommitModal from './git/GitCommitModal'
import GitMergeModal from './git/GitMergeModal'
import MergeConflictResolver from './git/MergeConflictResolver'

import { GitSidebarBranches } from './git/GitSidebarBranches'
import { GitBranchDetailsPanel } from './git/GitBranchDetailsPanel'
import { GitRightActionsPanel } from './git/GitRightActionsPanel'

function dedupeByName(list: GitUnifiedBranch[]): GitUnifiedBranch[] {
  const m = new Map<string, GitUnifiedBranch>()
  for (const b of list) {
    if (!m.has(b.name)) m.set(b.name, b)
  }
  return Array.from(m.values())
}

export default function GitView() {
  const { activeProject } = useProjectContext()
  const projectId = activeProject?.id
  const title = activeProject?.title
  const { unified, selection } = useGit()
  const nav = useNavigator()

  const { branches: unifiedBranches, stashes, loading, error } = unified.get(projectId)

  // Feature requirement: show local branches only (deduped)
  const localBranches = React.useMemo(
    () => dedupeByName((unifiedBranches || []).filter((b) => b.isLocal)),
    [unifiedBranches],
  )

  const [isClean, setIsClean] = React.useState<boolean | undefined>(undefined)
  const [checkingClean, setCheckingClean] = React.useState(false)
  const [changedCount, setChangedCount] = React.useState<number>(0)

  const current = React.useMemo(() => localBranches?.find((b) => b.current), [localBranches])
  const others = React.useMemo(() => (localBranches || []).filter((b) => !b.current), [localBranches])

  const sel = selection.get(projectId)
  const selectedBranchName = sel?.kind === 'branch' ? sel.branchName : undefined
  const selectedStashRef = sel?.kind === 'stash' ? sel.stashRef : undefined

  const reload = React.useCallback(() => {
    void unified.reload(projectId)
  }, [unified, projectId])

  const loadCleanStatus = React.useCallback(async () => {
    if (!projectId) return
    setCheckingClean(true)
    try {
      const s = await gitService.getLocalStatus(projectId)
      const any = (v: any) => {
        if (!v) return false
        if (Array.isArray(v)) return v.length > 0
        if (typeof v === 'object') return Object.keys(v).length > 0
        if (typeof v === 'number') return v > 0
        return !!v
      }
      const num = (v: any): number => (Array.isArray(v) ? v.length : typeof v === 'number' ? v : 0)
      const dirty = [
        (s as any).isClean === false,
        any((s as any).unstaged),
        any((s as any).staged),
        any((s as any).conflicts),
        any((s as any).changed),
        any((s as any).untracked),
      ].some(Boolean)
      const count =
        num((s as any).unstaged) +
        num((s as any).staged) +
        num((s as any).untracked) +
        num((s as any).conflicts) +
        num((s as any).changed)
      setIsClean(!dirty)
      setChangedCount(count)
    } catch (e) {
      setIsClean(undefined)
      setChangedCount(0)
    } finally {
      setCheckingClean(false)
    }
  }, [projectId])

  React.useEffect(() => {
    void loadCleanStatus()
  }, [projectId, loadCleanStatus])

  // Immediate refresh listener after commit/merge
  React.useEffect(() => {
    const handler = (ev: any) => {
      const pid = ev?.detail?.projectId
      if (projectId && pid && pid !== projectId) return
      void unified.reload(projectId)
      void loadCleanStatus()
    }
    window.addEventListener('git:refresh-now' as any, handler as any)
    return () => window.removeEventListener('git:refresh-now' as any, handler as any)
  }, [projectId, unified, loadCleanStatus])

  // Default selection: current branch (when it becomes known)
  React.useEffect(() => {
    if (!projectId) return
    if (!current?.name) return
    if (!selection.get(projectId)) {
      selection.selectBranch(projectId, current.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, current?.name])

  // If selected branch disappears, fall back to current.
  React.useEffect(() => {
    if (!projectId) return
    if (!localBranches || localBranches.length === 0) return
    if (selectedBranchName && !localBranches.some((b) => b.name === selectedBranchName)) {
      if (current?.name) selection.selectBranch(projectId, current.name)
      else selection.clear(projectId)
    }
  }, [projectId, localBranches, selectedBranchName, current?.name, selection])

  const isEqualToCurrent = React.useCallback(
    (b: GitUnifiedBranch): boolean => {
      if (!current) return false
      const currSha = current.localSha
      if (!currSha) return false
      if (b.localSha && b.localSha === currSha) return true
      if (b.remoteSha && b.remoteSha === currSha) return true
      return false
    },
    [current],
  )

  const selectedBranch = React.useMemo(() => {
    if (!selectedBranchName) return undefined
    return (localBranches || []).find((b) => b.name === selectedBranchName)
  }, [localBranches, selectedBranchName])

  const onSelectBranch = React.useCallback(
    (name: string) => {
      selection.selectBranch(projectId, name)
    },
    [selection, projectId],
  )

  const onSelectStash = React.useCallback(
    (ref: string) => {
      selection.selectStash(projectId, ref)
    },
    [selection, projectId],
  )

  const canSwitch = isClean === true

  const switchToBranch = React.useCallback(
    async (name: string) => {
      if (!projectId) return
      await loadCleanStatus()
      if (isClean === false) {
        alert('Working tree not clean. Commit or discard changes before switching.')
        return
      }
      const res = await gitService.checkout(projectId, name)
      if (!res?.ok) {
        alert(`Switch failed: ${res?.error || 'unknown error'}`)
      } else {
        await unified.reload(projectId)
        await loadCleanStatus()
      }
    },
    [projectId, loadCleanStatus, isClean, unified],
  )

  const [showCommit, setShowCommit] = React.useState(false)
  const [commitBranch, setCommitBranch] = React.useState<string | undefined>(undefined)

  const [showMerge, setShowMerge] = React.useState(false)
  const [mergeBase, setMergeBase] = React.useState<string | undefined>(undefined)
  const [mergeHead, setMergeHead] = React.useState<string | undefined>(undefined)

  const [conflict, setConflict] = React.useState<
    | undefined
    | {
        projectId: string
        baseRef: string
        headRef: string
        mergeMessage?: string
      }
  >(undefined)

  const openCommit = (branchName: string) => {
    setCommitBranch(branchName)
    setShowCommit(true)
  }

  const openMerge = (baseRef: string, headRef: string) => {
    setMergeBase(baseRef)
    setMergeHead(headRef)
    setShowMerge(true)
  }

  return (
    <div className="flex h-full min-h-0">
      <GitSidebarBranches
        title={title}
        projectId={projectId}
        loading={loading}
        error={error}
        localBranches={localBranches}
        stashes={stashes}
        current={current}
        others={others}
        selectedBranchName={selectedBranchName}
        selectedStashRef={selectedStashRef}
        canSwitch={canSwitch}
        isEqualToCurrent={isEqualToCurrent}
        onSelectBranch={onSelectBranch}
        onSelectStash={onSelectStash}
        onCommit={openCommit}
        onMerge={openMerge}
        onDelete={() => {
          alert('Delete branch: stub. Wire to gitService.deleteLocalBranch when available.')
        }}
        onSwitch={switchToBranch}
      />

      <GitBranchDetailsPanel
        projectId={projectId}
        loading={loading}
        error={error}
        selectedBranch={selectedBranch}
        selectedStashRef={selectedStashRef}
        currentBranch={current}
        checkingClean={checkingClean}
        isClean={isClean}
        changedCount={changedCount}
        onRefresh={reload}
        onGoProject={() => nav.navigate('Projects')}
        onOpenMerge={openMerge}
      />

      <GitRightActionsPanel
        selectedBranch={selectedBranch}
        selectedStashRef={selectedStashRef}
        checkingClean={checkingClean}
        isClean={isClean}
        changedCount={changedCount}
        onRefresh={() => {
          void loadCleanStatus()
          reload()
        }}
        onSwitchToBranch={switchToBranch}
        onOpenMerge={openMerge}
        currentBranchName={current?.name}
      />

      {showCommit && projectId && commitBranch ? (
        <GitCommitModal
          projectId={projectId}
          branch={commitBranch}
          onClose={() => setShowCommit(false)}
          onAfterCommit={() => {
            setShowCommit(false)
            window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } }))
          }}
        />
      ) : null}

      {showMerge && projectId && mergeBase && mergeHead ? (
        <GitMergeModal
          projectId={projectId}
          baseRef={mergeBase}
          headRef={mergeHead}
          onClose={() => setShowMerge(false)}
          onConflict={(payload) => {
            setShowMerge(false)
            setConflict({ projectId, baseRef: mergeBase, headRef: mergeHead, mergeMessage: payload?.message })
          }}
          onAfterMerge={() => {
            setShowMerge(false)
            window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } }))
          }}
        />
      ) : null}

      {conflict ? (
        <MergeConflictResolver
          projectId={conflict.projectId}
          baseRef={conflict.baseRef}
          headRef={conflict.headRef}
          mergeMessage={conflict.mergeMessage}
          onClose={() => {
            setConflict(undefined)
            window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } }))
          }}
        />
      ) : null}
    </div>
  )
}
