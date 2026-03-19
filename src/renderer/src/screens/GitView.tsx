import React from 'react'
import { gitService } from '@renderer/services/gitService'
import { GitConflictEntry, GitUnifiedBranch } from 'thefactory-tools'
import { useProjectContext } from '../contexts/ProjectContext'
import { useGit } from '../contexts/GitContext'
import { useNavigator } from '../navigation/Navigator'
import GitCommitModal from './git/modals/GitCommitModal'
import GitMergeModal from './git/modals/merge/GitMergeModal'
import MergeConflictResolver from './git/mergeConflict/MergeConflictResolver'
import { GitSidebar } from './git/sidebar/GitSidebar'
import { GitBranchDetailsPanel } from './git/GitBranchDetailsPanel'
import { GitActionsPanel } from './git/actions/GitActionsPanel'
import { GitCheckoutRemoteModal } from './git/modals/GitCheckoutRemoteModal'

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

  const localBranches = React.useMemo(
    () => dedupeByName((unifiedBranches || []).filter((b) => b.isLocal)),
    [unifiedBranches],
  )
  const remoteBranches = React.useMemo(
    () => dedupeByName((unifiedBranches || []).filter((b) => b.isRemote)),
    [unifiedBranches],
  )

  const [isClean, setIsClean] = React.useState<boolean | undefined>(undefined)
  const [checkingClean, setCheckingClean] = React.useState(false)
  const [changedCount, setChangedCount] = React.useState<number>(0)

  const current = React.useMemo(() => localBranches.find((b) => b.current), [localBranches])

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
    } catch {
      setIsClean(undefined)
      setChangedCount(0)
    } finally {
      setCheckingClean(false)
    }
  }, [projectId])

  React.useEffect(() => {
    void loadCleanStatus()
  }, [projectId, loadCleanStatus])

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

  // Default selection: current branch on first load
  React.useEffect(() => {
    if (!projectId || !current?.name) return
    if (!selection.get(projectId)) {
      selection.selectBranch(projectId, current.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, current?.name])

  // Clear stale selection when branches change
  React.useEffect(() => {
    if (!projectId) return
    if (!localBranches.length && !remoteBranches.length) return
    if (
      selectedBranchName &&
      !localBranches.some((b) => b.name === selectedBranchName) &&
      !remoteBranches.some((b) => b.name === selectedBranchName)
    ) {
      if (current?.name) selection.selectBranch(projectId, current.name)
      else selection.clear(projectId)
    }
  }, [projectId, localBranches, remoteBranches, selectedBranchName, current?.name, selection])

  const isEqualToCurrent = React.useCallback(
    (b: GitUnifiedBranch): boolean => {
      if (!current) return false
      const sha = current.localSha
      if (!sha) return false
      return b.localSha === sha || b.remoteSha === sha
    },
    [current],
  )

  const selectedBranch = React.useMemo(() => {
    if (!selectedBranchName) return undefined
    return (
      localBranches.find((b) => b.name === selectedBranchName) ??
      remoteBranches.find((b) => b.name === selectedBranchName)
    )
  }, [localBranches, remoteBranches, selectedBranchName])

  // ─── Sidebar callbacks ─────────────────────────────────────────────────────
  const onSelectBranch = React.useCallback(
    (b: GitUnifiedBranch) => selection.selectBranch(projectId, b.name),
    [selection, projectId],
  )
  const onSelectStash = React.useCallback(
    (ref: string) => selection.selectStash(projectId, ref),
    [selection, projectId],
  )

  const onSelectBranchBySha = React.useCallback(
    (sha: string) => {
      const local = localBranches.find((b) => b.localSha === sha)
      if (local) {
        selection.selectBranch(projectId, local.name)
        return
      }
      const remote = remoteBranches.find((b) => b.remoteSha === sha)
      if (remote) selection.selectBranch(projectId, remote.name)
    },
    [localBranches, remoteBranches, selection, projectId],
  )

  const handleStashAppliedOrDeleted = React.useCallback(() => {
    if (projectId && current?.name) selection.selectBranch(projectId, current.name)
  }, [projectId, current?.name, selection])

  // ─── Switch / checkout ─────────────────────────────────────────────────────
  const [checkoutRemoteBranch, setCheckoutRemoteBranch] = React.useState<
    GitUnifiedBranch | undefined
  >()

  const switchToBranch = React.useCallback(
    async (b: GitUnifiedBranch) => {
      if (!projectId) return
      await loadCleanStatus()
      if (isClean === false) {
        alert(
          'Working tree is not clean. Please commit or stash your changes before switching branches.',
        )
        return
      }
      if (b.isLocal) {
        const res = await gitService.checkout(projectId, b.name)
        if (!res?.ok) {
          alert(`Switch failed: ${res?.error || 'unknown error'}`)
        } else {
          await unified.reload(projectId)
          await loadCleanStatus()
        }
      } else {
        setCheckoutRemoteBranch(b)
      }
    },
    [projectId, loadCleanStatus, isClean, unified],
  )

  // ─── Modals ────────────────────────────────────────────────────────────────
  const [showCommit, setShowCommit] = React.useState(false)
  const [commitBranch, setCommitBranch] = React.useState<string | undefined>(undefined)

  const [showMerge, setShowMerge] = React.useState(false)
  const [mergeBase, setMergeBase] = React.useState<string | undefined>(undefined)
  const [mergeHead, setMergeHead] = React.useState<string | undefined>(undefined)

  // Conflict resolver state — matches MergeConflictResolverProps exactly
  const [conflict, setConflict] = React.useState<
    | { projectId: string; baseRef: string; branch: string; conflicts: GitConflictEntry[] }
    | undefined
  >(undefined)

  const openMerge = (baseRef: string, headRef: string) => {
    setMergeBase(baseRef)
    setMergeHead(headRef)
    setShowMerge(true)
  }

  // ─── Resolve conflict from a file row click ────────────────────────────────
  // When the user clicks "Resolve Conflict" on a specific file in GitLocalChanges,
  // we load all conflicted files for that project (git status) and open the resolver.
  const handleResolveConflict = React.useCallback(
    async (filePath: string) => {
      if (!projectId) return
      try {
        // Get the full diff lists to find all conflicted (status=U) files
        const [stagedList, unstagedList] = await Promise.all([
          gitService.getLocalDiffSummary(projectId, { staged: true }),
          gitService.getLocalDiffSummary(projectId, { staged: false }),
        ])
        const allFiles = [...(stagedList || []), ...(unstagedList || [])]
        const conflictedPaths = Array.from(
          new Set(
            allFiles
              .filter((f: any) => f?.status === 'U')
              .map((f: any) => f?.path || '')
              .filter(Boolean),
          ),
        )
        // Build GitConflictEntry list; put the clicked file first
        const entries: GitConflictEntry[] = conflictedPaths.map((p) => ({
          path: p,
          type: 'both_modified' as const,
        }))
        const sorted = [
          ...entries.filter((e) => e.path === filePath),
          ...entries.filter((e) => e.path !== filePath),
        ]
        if (sorted.length === 0) {
          // Fallback: just open for the single file
          sorted.push({ path: filePath, type: 'both_modified' as const })
        }
        // Try to read MERGE_HEAD so we can pass the incoming branch name
        let incomingBranch = 'MERGE_HEAD'
        try {
          const mergeHeadContent = await gitService.getFileContent(
            projectId,
            '.git/MERGE_HEAD',
            'HEAD',
          )
          if (mergeHeadContent?.trim()) incomingBranch = mergeHeadContent.trim()
        } catch {}
        setConflict({
          projectId,
          baseRef: current?.name || 'HEAD',
          branch: incomingBranch,
          conflicts: sorted,
        })
      } catch (e: any) {
        alert(`Failed to open conflict resolver: ${e?.message || String(e)}`)
      }
    },
    [projectId, current?.name],
  )

  void nav // suppress unused-var lint

  return (
    <div className="flex h-full min-h-0">
      <GitSidebar
        title={title}
        projectId={projectId}
        loading={loading}
        error={error}
        localBranches={localBranches}
        remoteBranches={remoteBranches}
        stashes={stashes}
        current={current}
        selectedBranchName={selectedBranchName}
        selectedStashRef={selectedStashRef}
        isEqualToCurrent={isEqualToCurrent}
        onSelectBranch={onSelectBranch}
        onDoubleClickBranch={switchToBranch}
        onSelectStash={onSelectStash}
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
        onOpenMerge={openMerge}
        onSelectBranchBySha={onSelectBranchBySha}
        onResolveConflict={handleResolveConflict}
      />

      <GitActionsPanel
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
        onStashAppliedOrDeleted={handleStashAppliedOrDeleted}
      />

      {showCommit && projectId && commitBranch ? (
        <GitCommitModal
          projectId={projectId}
          currentBranch={commitBranch}
          onRequestClose={() => setShowCommit(false)}
          onAfterCommit={() => {
            setShowCommit(false)
            window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } }))
          }}
        />
      ) : null}

      {showMerge && projectId && mergeBase && mergeHead ? (
        <GitMergeModal
          projectId={projectId}
          repoPath={''}
          baseRef={mergeBase}
          branch={mergeHead}
          onRequestClose={() => setShowMerge(false)}
        />
      ) : null}

      {conflict ? (
        <MergeConflictResolver
          projectId={conflict.projectId}
          baseRef={conflict.baseRef}
          branch={conflict.branch}
          conflicts={conflict.conflicts}
          onClose={() => {
            setConflict(undefined)
            window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } }))
          }}
        />
      ) : null}

      {checkoutRemoteBranch && projectId ? (
        <GitCheckoutRemoteModal
          projectId={projectId}
          remoteBranchName={checkoutRemoteBranch.name}
          onRequestClose={() => setCheckoutRemoteBranch(undefined)}
          onSuccess={() => {
            setCheckoutRemoteBranch(undefined)
            window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } }))
          }}
        />
      ) : null}
    </div>
  )
}
