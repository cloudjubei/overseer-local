import { useCallback, useEffect, useState } from 'react'
import type { PointerEvent } from 'react'
import { useActiveProject } from 'thefactory-ui/headless'
import { useGit } from 'thefactory-ui/headless'
import { getGitBranchDiffSummary } from 'thefactory-ui/headless/api'
import { getPRUrl } from 'thefactory-ui/headless'
import {
  Alert,
  Button,
  ConfirmDialog,
  GitSidebar,
  ICON_RAIL_DEFAULT_WIDTH,
  IconRail,
  IconRailButton,
  ResizeHandle,
  useLocalStorageBool,
  useLocalStorageNumber,
} from 'thefactory-ui/web'
import {
  IconArchive,
  IconArrowDown,
  IconBranch,
  IconChevron,
  IconChevronDown,
  IconCommit,
  IconDelete,
  IconDoubleUp,
  IconFastMerge,
  IconPullRequest,
  IconRefresh,
} from 'thefactory-ui/web/icons'
import {
  CommitDialog,
  CheckoutDialog,
  CreateBranchDialog,
  LoadingScreen,
  MergeConflictResolver,
  MergeDialog,
  StashDialog,
} from 'thefactory-ui/web'
import { CommitDiffViewer, type CommitDiffFetcher } from 'thefactory-ui/web'
import LocalChangesPane from '@ui/components/git/LocalChangesPane'
import LogPanel from '@ui/components/git/LogPanel'

type Modal = 'commit' | 'checkout' | 'create-branch' | 'merge' | 'stash' | null
type MergeArgs = { baseRef: string; branch: string }
type BusyOp = 'push' | 'pull' | 'fetch' | 'refresh' | null

const DIRTY_TREE_MESSAGE =
  'Working tree is not clean. Please commit or stash your changes before switching branches.'

const SIDEBAR_COLLAPSED_KEY = 'GitView.sidebarCollapsed'
const TOP_HEIGHT_KEY = 'GitView.commitGraphHeightPx'
const DEFAULT_TOP_HEIGHT = 280

export default function GitView() {
  const { projectId, project } = useActiveProject()
  const {
    isLoaded,
    loadError,
    branches,
    stashes,
    status,
    log,
    localDiff,
    push,
    pull,
    fetch: fetchRemote,
    checkout,
    refresh,
    applyStash,
    dropStash,
    deleteBranch,
  } = useGit()
  const commitDiffFetcher = useCallback<CommitDiffFetcher>(
    async ({ baseRef, headRef, includePatch }, signal) => {
      const { data } = await getGitBranchDiffSummary({
        path: { projectId: projectId ?? '' },
        body: { baseRef, headRef, includePatch },
        signal,
        throwOnError: true,
      })
      return data
    },
    [projectId],
  )
  const [modal, setModal] = useState<Modal>(null)
  const [busy, setBusy] = useState<BusyOp>(null)
  const [opError, setOpError] = useState<string | null>(null)
  const [selectedBranchName, setSelectedBranchName] = useState<string | undefined>()
  // Which side of a same-named branch the user picked. A branch can appear
  // in both Branches and Remotes when its local and remote SHAs differ —
  // the two anchor on different commits, so the section is part of the
  // selection identity.
  const [selectedBranchSection, setSelectedBranchSection] = useState<
    'local' | 'remote' | undefined
  >()
  const [selectedStashRef, setSelectedStashRef] = useState<string | undefined>()
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | undefined>()
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null)
  const [conflictResolverFile, setConflictResolverFile] = useState<string | null>(null)
  // Direction-specific args for the merge dialog so the rail's "Merge" and
  // "Merge In" both open the same modal but pre-filled with the right
  // base/source pair (matches desktop's flow).
  const [mergeArgs, setMergeArgs] = useState<MergeArgs | null>(null)

  // Collapsible left aside — matches the Files/Tools pattern (inline, no
  // shared component). Width transitions are animated; collapsed = 48px,
  // expanded delegates to the lifted `GitSidebar`'s own width state.
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorageBool(SIDEBAR_COLLAPSED_KEY, false)

  // Vertical split between commit graph (top) and changes/diff (bottom).
  const [topHeightPx, setTopHeightPx] = useLocalStorageNumber(TOP_HEIGHT_KEY, DEFAULT_TOP_HEIGHT)
  const onTopResizeStart = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = topHeightPx
    const container = (e.currentTarget as HTMLElement).parentElement
    const containerH = container?.clientHeight ?? window.innerHeight
    const onMove = (ev: globalThis.PointerEvent) => {
      const minTop = 80
      const maxTop = Math.max(minTop, Math.floor(containerH * 0.85))
      setTopHeightPx(Math.max(minTop, Math.min(maxTop, startH + ev.clientY - startY)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const localBranches = branches.filter((b) => b.isLocal)
  // A branch can be both local AND remote (normal state after a push). Desktop
  // shows such branches in both sections; we mirror that so Remotes isn't
  // silently empty when every branch happens to also exist locally.
  const remoteBranches = branches.filter((b) => b.isRemote)
  const current = branches.find((b) => b.current)
  const currentBranchName = current?.name

  // Switching projects must clear the per-project Git selection — a branch
  // name from project A might exist in project B with a totally different
  // SHA, and a commit SHA from project A certainly doesn't resolve in
  // project B's repo (the `getBranchDiffSummary` route 500s on
  // `git merge-base <foreign-sha>` with "Not a valid commit name"). Reset
  // everything here so the auto-select effect below picks the new
  // project's current branch / tip from scratch.
  useEffect(() => {
    setSelectedBranchName(undefined)
    setSelectedBranchSection(undefined)
    setSelectedStashRef(undefined)
    setSelectedCommitSha(undefined)
    setOpError(null)
  }, [projectId])

  // Default the rail selection to the current branch on mount so the full
  // set of rail actions (Commit, Pull, Push, …) is visible immediately —
  // without this only Refresh shows until the user clicks something. Gated
  // on `isLoaded` so the auto-select can never pick from STALE branches:
  // on project switch the reset effect above clears `selectedBranchName`,
  // but the GitContext re-fetch is async — without this guard a brief
  // window exists where `branches` is still the previous project's data
  // and we'd re-select that project's current branch.
  // Lives above the `isLoaded` / `loadError` short-circuits so the hook
  // order stays stable across the not-yet-loaded → loaded transition (React
  // Rules of Hooks).
  useEffect(() => {
    if (!isLoaded) return
    if (selectedBranchName || selectedStashRef) return
    if (currentBranchName) {
      setSelectedBranchName(currentBranchName)
      // The current branch's working-tree state (UNCOMMITTED) and its
      // local tip are the local-side anchors. `sectionMatches` lights up
      // the remote row too when local/remote SHAs happen to be equal.
      setSelectedBranchSection('local')
    }
  }, [isLoaded, currentBranchName, selectedBranchName, selectedStashRef])

  if (!isLoaded) return <LoadingScreen label="Loading git status…" />
  if (loadError)
    return (
      <LoadingScreen
        label="Could not load git"
        error={loadError.message}
        onRetry={() => void refresh()}
      />
    )

  const selectedBranch = selectedBranchName
    ? branches.find((b) => b.name === selectedBranchName)
    : undefined

  // When a branch is selected (from the sidebar or initial auto-select),
  // scroll the graph to its tip — matches desktop's `scrollToSha` flow so
  // the user doesn't have to hunt for the branch's head commit. For the
  // current branch we anchor on the UNCOMMITTED stub when there are
  // pending changes (the graph renders it as the top row in that case),
  // otherwise fall through to the branch's actual tip commit.
  const hasUncommittedChanges =
    (status?.staged.length ?? 0) +
      (status?.unstaged.length ?? 0) +
      (status?.untracked.length ?? 0) >
    0
  // Anchor SHA for the commit graph. When the user picked the Remote row
  // of a name that exists in both sections, anchor on `remoteSha`; the
  // local-side anchor stays on `localSha` (or UNCOMMITTED for the current
  // branch with a dirty tree). If only one side exists, fall back to the
  // available SHA in either order.
  const branchTipSha = selectedBranch
    ? selectedBranch.current && hasUncommittedChanges && selectedBranchSection !== 'remote'
      ? 'UNCOMMITTED'
      : selectedBranchSection === 'remote'
        ? (selectedBranch.remoteSha ?? selectedBranch.localSha ?? undefined)
        : (selectedBranch.localSha ?? selectedBranch.remoteSha ?? undefined)
    : undefined

  // Mirror desktop's pre-checkout guard — a dirty tree blocks branch switching
  // so silent overwrites never happen. Untracked files don't count: `git
  // checkout` carries them over without complaint.
  const dirtyFileCount = (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0)
  const isDirty = dirtyFileCount > 0
  const isClean = !isDirty

  const runOp = async (kind: BusyOp, op: () => Promise<unknown>) => {
    if (!kind) return
    setBusy(kind)
    setOpError(null)
    try {
      await op()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : `Failed to ${kind}`)
    } finally {
      setBusy(null)
    }
  }

  const onDoubleClickBranch = (name: string) => {
    if (isDirty) {
      setOpError(DIRTY_TREE_MESSAGE)
      return
    }
    void checkout(name)
  }

  // Mirror desktop: when the user picks a commit in the graph that's the tip
  // of a branch, also select that branch in the sidebar. Falls back to the
  // remote tracking ref so picking an unpulled-remote commit still works.
  const onSelectBranchBySha = (sha: string) => {
    // UNCOMMITTED always belongs to the local current branch — the working
    // tree lives on it. (`sectionMatches` lights up the remote row too
    // when local/remote SHAs are equivalent for that branch.)
    if (sha === 'UNCOMMITTED') {
      const cur = branches.find((b) => b.current && b.isLocal)
      if (cur) {
        setSelectedBranchName(cur.name)
        setSelectedBranchSection('local')
        setSelectedStashRef(undefined)
      }
      return
    }
    // Idempotent: if the current selection's tip already matches the sha,
    // keep it — prevents flipping local↔remote when both happen to point
    // at the same commit (in-sync branch).
    if (selectedBranch) {
      const tip =
        selectedBranchSection === 'remote'
          ? selectedBranch.remoteSha
          : selectedBranch.localSha
      if (tip === sha) return
    }
    const local = branches.find((b) => b.isLocal && b.localSha === sha)
    if (local) {
      setSelectedBranchName(local.name)
      setSelectedBranchSection('local')
      setSelectedStashRef(undefined)
      return
    }
    const remote = branches.find((b) => b.isRemote && b.remoteSha === sha)
    if (remote) {
      setSelectedBranchName(remote.name)
      setSelectedBranchSection('remote')
      setSelectedStashRef(undefined)
      return
    }
    // No branch tip matches — historical commit. Clear the sidebar so the
    // selection doesn't imply a wrong association.
    setSelectedBranchName(undefined)
    setSelectedBranchSection(undefined)
    setSelectedStashRef(undefined)
  }

  const onSwitchToSelected = () => {
    if (!selectedBranch || selectedBranch.current) return
    if (isDirty) {
      setOpError(DIRTY_TREE_MESSAGE)
      return
    }
    void runOp('refresh', () => checkout(selectedBranch.name))
  }

  const onCreatePR = () => {
    if (!project?.repo_url || !selectedBranch) return
    const url = getPRUrl(project.repo_url, selectedBranch.name, 'main')
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else setOpError(`Could not build PR URL for ${project.repo_url}`)
  }

  // Desktop's stash flow does "apply, then optionally drop". Web keeps the
  // explicit Apply/Drop buttons separate so the user picks intentionally.
  const onStashApply = () => void onStashOp('apply')
  const onStashDrop = () => void onStashOp('drop')

  async function onStashOp(op: 'apply' | 'pop' | 'drop') {
    if (!selectedStashRef) return
    setOpError(null)
    try {
      if (op === 'drop') {
        await dropStash({ ref: selectedStashRef })
        setSelectedStashRef(undefined)
      } else {
        await applyStash({ ref: selectedStashRef, pop: op === 'pop' })
        if (op === 'pop') setSelectedStashRef(undefined)
      }
    } catch (err) {
      setOpError(err instanceof Error ? err.message : `Failed to ${op} stash`)
    }
  }

  // ─── Action-rail predicates — mirrored from desktop's `GitActionsPanel` ──
  const railBusy = busy !== null
  const canCommit = !!selectedBranch?.isLocal && isDirty && !railBusy
  const pushCount = selectedBranch?.ahead ?? 0
  const canPush = !railBusy && (pushCount > 0 || !selectedBranch?.isRemote)
  const canCreateBranch = !!selectedBranch?.isLocal && !railBusy
  const canCreatePR =
    !!selectedBranch &&
    selectedBranch.name !== 'main' &&
    selectedBranch.name !== 'master' &&
    !!project?.repo_url &&
    !railBusy
  const canSwitch = isClean && !railBusy
  const canMerge = !!selectedBranch?.isLocal && !!currentBranchName && !railBusy
  const canStash = !!selectedBranch?.isLocal && isDirty && !railBusy

  return (
    <div className="flex w-full h-full overflow-hidden">
      {/* Left aside — collapsible (matches Files/Tools) */}
      <aside
        className="shrink-0 flex flex-col border-r overflow-hidden transition-[width]"
        style={{
          // Expanded width is owned entirely by `GitSidebar`'s own resize
          // state. The aside must NOT impose a second, larger `minWidth` —
          // that let the resizable inner panel shrink narrower than this
          // wrapper, detaching the drag handle from the panel's edge.
          width: sidebarCollapsed ? 48 : undefined,
          minWidth: sidebarCollapsed ? 48 : undefined,
          borderColor: 'var(--border-subtle)',
          background: 'var(--surface-base)',
        }}
      >
        <div
          className={`flex items-center gap-2 px-2 py-2 shrink-0 ${
            sidebarCollapsed ? 'justify-center' : 'justify-end'
          }`}
        >
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <IconChevron
              className="w-4 h-4"
              style={{ transform: sidebarCollapsed ? undefined : 'rotate(180deg)' }}
            />
          </Button>
        </div>
        {!sidebarCollapsed && (
          <GitSidebar
            projectId={projectId}
            loading={false}
            localBranches={localBranches}
            remoteBranches={remoteBranches}
            stashes={stashes}
            current={current}
            selectedBranchName={selectedBranchName}
            selectedBranchSection={selectedBranchSection}
            selectedStashRef={selectedStashRef}
            dirtyCount={dirtyFileCount}
            onSelectBranch={(b, section) => {
              setSelectedBranchName(b.name)
              setSelectedBranchSection(section)
              setSelectedStashRef(undefined)
              setSelectedCommitSha(undefined)
            }}
            onDoubleClickBranch={(b) => onDoubleClickBranch(b.name)}
            onSelectStash={(ref) => {
              setSelectedStashRef(ref)
              setSelectedBranchName(undefined)
              setSelectedBranchSection(undefined)
              setSelectedCommitSha(undefined)
            }}
          />
        )}
      </aside>

      {/* Center — graph (top) + changes/diff (bottom), split by resize handle */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {opError && (
          <div className="px-4 pt-3 shrink-0">
            <Alert>{opError}</Alert>
          </div>
        )}

        {selectedStashRef ? (
          // Stash selection mirrors desktop: the commit graph is irrelevant
          // (stashes aren't part of the branch history), so the file/diff
          // viewer takes the full pane.
          <section className="flex flex-col flex-1 min-h-0">
            <CommitDiffViewer commitSha={selectedStashRef} log={log} fetcher={commitDiffFetcher} />
          </section>
        ) : (
          <>
            {/* Top: commit graph */}
            <section
              className="flex flex-col shrink-0 border-b min-h-0"
              style={{ height: topHeightPx, borderColor: 'var(--border-subtle)' }}
            >
              <LogPanel
                selectedCommitSha={selectedCommitSha}
                scrollToSha={branchTipSha}
                onSelectCommit={setSelectedCommitSha}
                onSelectBranchBySha={onSelectBranchBySha}
              />
            </section>

            <ResizeHandle orientation="horizontal" onResizeStart={onTopResizeStart} />

            {/* Bottom: commit diff / local changes (no chrome label; the
                parent navigation already indicates which view this is). */}
            <section className="flex flex-col flex-1 min-h-0">
              {selectedCommitSha && selectedCommitSha !== 'UNCOMMITTED' ? (
                <CommitDiffViewer
                  commitSha={selectedCommitSha}
                  log={log}
                  fetcher={commitDiffFetcher}
                />
              ) : (
                <LocalChangesPane onResolveConflict={(file) => setConflictResolverFile(file)} />
              )}
            </section>
          </>
        )}
      </div>

      {/* Right: actions rail — `IconRail` + `IconRailButton`, mirroring desktop's
         `GitActionsPanel`. Buttons hide/disable based on selection + clean tree. */}
      <IconRail width={ICON_RAIL_DEFAULT_WIDTH}>
        <IconRailButton
          icon={<IconRefresh className="w-5 h-5" />}
          label="Refresh"
          onClick={() => void runOp('refresh', () => refresh())}
          disabled={railBusy}
          tooltip={
            isDirty ? `Working tree: dirty • ${dirtyFileCount} changed` : 'Working tree: clean'
          }
        />

        {selectedBranch && (
          <>
            <IconRailButton
              icon={<IconCommit className="w-5 h-5" />}
              label="Commit"
              onClick={() => setModal('commit')}
              disabled={!canCommit}
              tooltip={
                !selectedBranch.isLocal
                  ? 'Select a local branch to commit'
                  : !isDirty
                    ? 'No changes to commit'
                    : 'Commit staged/unstaged changes'
              }
            />

            {selectedBranch.isLocal && (
              <>
                <IconRailButton
                  icon={<IconArrowDown className="w-5 h-5" />}
                  label="Pull"
                  onClick={() => void runOp('pull', () => pull())}
                  disabled={railBusy}
                  tooltip="Pull from remote"
                />
                <IconRailButton
                  icon={<IconDoubleUp className="w-5 h-5" />}
                  label="Push"
                  onClick={() => void runOp('push', () => push())}
                  disabled={!canPush}
                  badge={pushCount}
                  tooltip={canPush ? `Push ${pushCount} commit(s)` : 'Nothing to push'}
                />
              </>
            )}

            <IconRailButton
              icon={<IconChevronDown className="w-5 h-5" />}
              label="Fetch"
              onClick={() => void runOp('fetch', () => fetchRemote())}
              disabled={railBusy}
              tooltip="Fetch from remote"
            />

            <IconRailButton
              icon={<IconBranch className="w-5 h-5" />}
              label="Branch"
              onClick={() => setModal('create-branch')}
              disabled={!canCreateBranch}
              tooltip={
                canCreateBranch
                  ? 'Create new branch from here'
                  : 'Select a local branch to create from'
              }
            />

            <IconRailButton
              icon={<IconPullRequest className="w-5 h-5" />}
              label="PR"
              onClick={onCreatePR}
              disabled={!canCreatePR}
              tooltip={
                canCreatePR
                  ? `Create Pull Request for ${selectedBranch.name}`
                  : 'Requires a branch (other than main) and a remote repo URL'
              }
            />

            {!selectedBranch.current && (
              <>
                <IconRailButton
                  icon={<IconBranch className="w-5 h-5" />}
                  label="Switch"
                  onClick={onSwitchToSelected}
                  disabled={railBusy || !canSwitch}
                  tooltip={
                    canSwitch
                      ? `Switch to ${selectedBranch.name}`
                      : 'Working tree must be clean to switch'
                  }
                />
                {selectedBranch.isLocal && (
                  <>
                    <IconRailButton
                      icon={<IconFastMerge className="w-5 h-5" />}
                      label="Merge"
                      onClick={() => {
                        if (!currentBranchName) return
                        setMergeArgs({
                          baseRef: currentBranchName,
                          branch: selectedBranch.name,
                        })
                        setModal('merge')
                      }}
                      disabled={!canMerge}
                      tooltip={
                        currentBranchName
                          ? `Merge ${selectedBranch.name} → ${currentBranchName}`
                          : 'Current branch unknown'
                      }
                    />
                    <IconRailButton
                      icon={<IconFastMerge className="w-5 h-5 transform rotate-180" />}
                      label="Merge In"
                      onClick={() => {
                        if (!currentBranchName) return
                        setMergeArgs({
                          baseRef: selectedBranch.name,
                          branch: currentBranchName,
                        })
                        setModal('merge')
                      }}
                      disabled={!canMerge}
                      tooltip={
                        currentBranchName
                          ? `Merge ${currentBranchName} → ${selectedBranch.name}`
                          : 'Current branch unknown'
                      }
                    />
                  </>
                )}
              </>
            )}

            <IconRailButton
              icon={<IconArchive className="w-5 h-5" />}
              label="Stash"
              onClick={() => setModal('stash')}
              disabled={!canStash}
              tooltip={
                !selectedBranch.isLocal
                  ? 'Select a local branch to stash'
                  : !isDirty
                    ? 'No changes to stash'
                    : 'Stash current changes'
              }
            />

            {!selectedBranch.current && (
              <IconRailButton
                icon={<IconDelete className="w-5 h-5 text-red-600 dark:text-red-400" />}
                label="Delete"
                onClick={() => setConfirmDeleteName(selectedBranch.name)}
                disabled={railBusy}
                tooltip={`Delete branch "${selectedBranch.name}"`}
              />
            )}
          </>
        )}

        {selectedStashRef && (
          <>
            <IconRailButton
              icon={<IconCommit className="w-5 h-5" />}
              label="Apply"
              onClick={onStashApply}
              disabled={railBusy}
              tooltip="Apply this stash"
            />
            <IconRailButton
              icon={<IconDelete className="w-5 h-5 text-red-600 dark:text-red-400" />}
              label="Drop"
              onClick={onStashDrop}
              disabled={railBusy}
              tooltip="Drop this stash"
            />
          </>
        )}
      </IconRail>

      <CommitDialog isOpen={modal === 'commit'} onClose={() => setModal(null)} />
      <CheckoutDialog isOpen={modal === 'checkout'} onClose={() => setModal(null)} />
      <CreateBranchDialog isOpen={modal === 'create-branch'} onClose={() => setModal(null)} />
      <MergeDialog
        isOpen={modal === 'merge'}
        onClose={() => {
          setModal(null)
          setMergeArgs(null)
        }}
        baseRef={mergeArgs?.baseRef}
        branch={mergeArgs?.branch}
      />
      <StashDialog isOpen={modal === 'stash'} onClose={() => setModal(null)} />
      <ConfirmDialog
        isOpen={confirmDeleteName !== null}
        onClose={() => setConfirmDeleteName(null)}
        onConfirm={async () => {
          if (!confirmDeleteName) return
          try {
            await deleteBranch(confirmDeleteName)
            if (selectedBranchName === confirmDeleteName) setSelectedBranchName(undefined)
          } catch (err) {
            setOpError(err instanceof Error ? err.message : 'Failed to delete branch')
          } finally {
            setConfirmDeleteName(null)
          }
        }}
        title="Delete branch"
        description={
          confirmDeleteName
            ? `Delete the branch "${confirmDeleteName}"? This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
      />
      {conflictResolverFile && current?.name && (
        <MergeConflictResolver
          isOpen={conflictResolverFile !== null}
          onClose={() => setConflictResolverFile(null)}
          baseRef="HEAD"
          branch={current.name}
          conflicts={(localDiff?.conflicts ?? []).map((path) => ({
            path,
            type: 'modify' as never,
          }))}
        />
      )}
    </div>
  )
}
