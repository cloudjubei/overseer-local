import React from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'
import Spinner from '../components/ui/Spinner'
import { useProjectContext } from '../contexts/ProjectContext'
import { useNavigator } from '../navigation/Navigator'
import { Button } from '../components/ui/Button'
import Tooltip from '../components/ui/Tooltip'
import { IconFastMerge } from '../components/ui/icons/IconFastMerge'
import { IconDelete } from '../components/ui/icons/IconDelete'
import { gitService } from '@renderer/services/gitService'
import { GitUnifiedBranch } from 'thefactory-tools'
import { useGit } from '../contexts/GitContext'
import DependencyBullet from '../components/stories/DependencyBullet'

function statusLabel(b: GitUnifiedBranch): string {
  if (b.current) return 'current'
  if (b.isLocal && b.isRemote) return 'both'
  if (b.isLocal && !b.isRemote) return 'local'
  if (!b.isLocal && b.isRemote) return 'remote'
  return 'unknown'
}

function getStoryId(u: GitUnifiedBranch): string | undefined {
  if (u.storyId) return u.storyId
  const tryParse = (name?: string): string | undefined => {
    if (!name) return undefined
    const m = name.match(/(?:^|\/)features\/([0-9a-fA-F-]{8,})/)
    return m ? m[1] : undefined
  }
  return tryParse(u.name) || tryParse(u.remoteName)
}

function AheadBehind({ b }: { b: GitUnifiedBranch }) {
  const ahead = b.ahead ?? 0
  const behind = b.behind ?? 0
  if (!ahead && !behind) return null
  return <div className="text-xs text-neutral-700 dark:text-neutral-300">{`${ahead}↑ / ${behind}↓`}</div>
}

function StatusChips({ b }: { b: GitUnifiedBranch }) {
  const label = statusLabel(b)
  return (
    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide">
      <span
        className={
          'px-1.5 py-0.5 rounded border ' +
          (b.current
            ? 'bg-emerald-100/60 border-emerald-300 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300'
            : b.isLocal && b.isRemote
            ? 'bg-blue-100/60 border-blue-300 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'
            : b.isLocal
            ? 'bg-violet-100/60 border-violet-300 text-violet-800 dark:bg-violet-900/20 dark:border-violet-700 dark:text-violet-300'
            : 'bg-amber-100/60 border-amber-300 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300')
        }
      >
        {label}
      </span>
    </div>
  )
}

function UnifiedBranchItem({
  projectId,
  projectTitle,
  baseRef = 'main',
  branch,
  mode = 'default',
  onAfterAction,
}: {
  projectId: string
  projectTitle?: string
  baseRef?: string
  branch: GitUnifiedBranch
  mode?: 'default' | 'current'
  onAfterAction?: () => void
}) {
  const { openModal } = useNavigator()
  const [deleting, setDeleting] = React.useState(false)
  const [summary, setSummary] = React.useState<{ loaded: boolean; error?: string; text?: string }>(
    { loaded: false },
  )
  const [pushing, setPushing] = React.useState(false)
  const [pulling, setPulling] = React.useState(false)

  const storyId = getStoryId(branch)

  const canQuickMerge = branch.isLocal || !!branch.remoteName
  const canDeleteLocal = branch.isLocal
  const canDeleteRemote = branch.isRemote && !branch.isLocal

  // Respect protected branches (main/master)
  const isProtectedBranch = (name?: string) => {
    if (!name) return false
    const short = name.replace(/^[^\/]+\//, '')
    return short === 'main' || short === 'master'
  }

  const openMergeModal = (opts: { openConfirm: boolean }) => {
    if (!canQuickMerge || mode === 'current') return
    openModal({
      type: 'git-merge',
      projectId,
      repoPath: '', // unknown at renderer; backend infers
      baseRef,
      branch: branch.isLocal ? branch.name : branch.remoteName || branch.name,
      storyId,
      openConfirm: opts.openConfirm,
    })
  }

  const onRowClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    openMergeModal({ openConfirm: false })
  }

  const onFastMergeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    openMergeModal({ openConfirm: true })
  }

  const loadSummary = async () => {
    if (summary.loaded) return
    try {
      const headRef = branch.isLocal ? branch.name : branch.remoteName || branch.name
      const diff = await gitService.getBranchDiffSummary(projectId, { baseRef, headRef })
      const fileLines = diff.files
        .slice(0, 10)
        .map(
          (f) =>
            `• ${f.path} (${f.status}${
              f.additions || f.deletions ? ` +${f.additions || 0}/-${f.deletions || 0}` : ''
            })`,
        )
      const more = diff.files.length > 10 ? `… and ${diff.files.length - 10} more` : ''
      const text = [
        `${diff.baseRef} → ${diff.headRef}`,
        `+${diff.insertions}/-${diff.deletions}`,
        ...fileLines,
        more,
      ]
        .filter(Boolean)
        .join('\n')
      setSummary({ loaded: true, text })
    } catch (e) {
      setSummary({ loaded: true, error: (e as any)?.message || 'Could not load summary' })
    }
  }

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (deleting) return
    const displayName = branch.name
    const remoteShort = (branch.remoteName || branch.name).replace(/^[^\/]+\//, '')

    // Protect main/master
    if (isProtectedBranch(displayName) || isProtectedBranch(remoteShort)) {
      alert('Protected branch cannot be deleted (main/master).')
      return
    }

    let deleteRemoteAlso = false
    if (branch.isLocal && branch.isRemote) {
      const okLocal = window.confirm(`Delete local branch '${displayName}'? This cannot be undone.`)
      if (!okLocal) return
      deleteRemoteAlso = window.confirm(`Also delete remote 'origin/${remoteShort}'?`)
    } else if (branch.isLocal) {
      const ok = window.confirm(`Delete local branch '${displayName}'? This cannot be undone.`)
      if (!ok) return
    } else if (branch.isRemote) {
      const ok = window.confirm(`Delete remote branch 'origin/${remoteShort}'? This cannot be undone.`)
      if (!ok) return
    } else {
      alert('This branch cannot be deleted from here.')
      return
    }

    setDeleting(true)
    try {
      // Delete local first when present
      if (branch.isLocal) {
        const resLocal = await gitService.deleteBranch(projectId, branch.name)
        if (!resLocal?.ok) alert(`Failed to delete local branch: ${resLocal?.error || 'unknown error'}`)
      }

      // Delete remote if remote-only or user opted to also delete
      if (branch.isRemote && (!branch.isLocal || deleteRemoteAlso)) {
        const short = (branch.remoteName || branch.name).replace(/^[^\/]+\//, '')
        const resRemote = await gitService.deleteRemoteBranch(projectId, short)
        if (!resRemote?.ok) alert(`Failed to delete remote branch: ${resRemote?.error || 'unknown error'}`)
      }
    } catch (err) {
      console.error('Delete branch failed', err)
      alert('Delete branch failed')
    } finally {
      setDeleting(false)
      onAfterAction?.()
    }
  }

  const remoteAndBranch = React.useMemo(() => {
    const remote = branch.upstreamRemote || 'origin'
    const remoteBranch = branch.upstreamBranch || branch.name
    return { remote, remoteBranch }
  }, [branch.upstreamRemote, branch.upstreamBranch, branch.name])

  const onPush = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (pushing) return
    setPushing(true)
    try {
      const res = await gitService.push(projectId, remoteAndBranch.remote, remoteAndBranch.remoteBranch)
      if (!res?.ok) alert(`Push failed: ${res?.error || 'unknown error'}`)
    } catch (err) {
      console.error('Push failed', err)
      alert('Push failed')
    } finally {
      setPushing(false)
      onAfterAction?.()
    }
  }

  const onPull = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (pulling) return
    setPulling(true)
    try {
      const res = await gitService.pull(projectId, remoteAndBranch.remote, remoteAndBranch.remoteBranch)
      if (!res?.ok) alert(`Pull failed: ${res?.error || 'unknown error'}`)
    } catch (err) {
      console.error('Pull failed', err)
      alert('Pull failed')
    } finally {
      setPulling(false)
      onAfterAction?.()
    }
  }

  const ahead = branch.ahead ?? 0
  const behind = branch.behind ?? 0
  const showPush = mode === 'current' && ahead > 0
  const showPull = mode === 'current' && behind > 0

  const row = (
    <div
      className={
        'flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-900 text-sm ' +
        (mode === 'current'
          ? 'bg-neutral-50/60 dark:bg-neutral-900/30'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/30')
      }
      role="button"
      onClick={onRowClick}
      onMouseEnter={() => {
        void loadSummary()
      }}
    >
      <div className="min-w-0">
        <div className="font-medium truncate flex items-center gap-2">
          <span className="truncate">{branch.name}</span>
          <StatusChips b={branch} />
        </div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
          {projectTitle ? `${projectTitle} · ` : ''}
          base {baseRef}
          {storyId ? (
            <span className="inline-flex items-center gap-1">
              {' '}
              •
              <span onClick={(e) => e.stopPropagation()}>
                <DependencyBullet dependency={storyId} />
              </span>
            </span>
          ) : (
            ''
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <AheadBehind b={branch} />
        <div className="flex items-center gap-1.5">
          {mode === 'current' ? (
            <>
              {showPull && (
                <Tooltip content={'pull from remote'} placement="bottom">
                  <span onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onPull}
                      loading={pulling}
                      aria-label="Pull"
                      title="Pull from remote"
                    >
                      Pull
                    </Button>
                  </span>
                </Tooltip>
              )}
              {showPush && (
                <Tooltip content={'push to remote'} placement="bottom">
                  <span onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onPush}
                      loading={pushing}
                      aria-label="Push"
                      title="Push to remote"
                    >
                      Push
                    </Button>
                  </span>
                </Tooltip>
              )}
            </>
          ) : (
            <>
              <Tooltip content={canQuickMerge ? 'fast merge' : 'unavailable'} placement="bottom">
                <span onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onFastMergeClick}
                    disabled={!canQuickMerge}
                    aria-label="Fast merge"
                    title="fast merge"
                  >
                    <IconFastMerge className="w-4 h-4" />
                  </Button>
                </span>
              </Tooltip>
              <Tooltip
                content={
                  canDeleteLocal ? 'delete local branch' : canDeleteRemote ? 'delete remote branch' : 'cannot delete'
                }
                placement="bottom"
              >
                <span onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDelete}
                    disabled={!canDeleteLocal && !canDeleteRemote}
                    loading={deleting}
                    aria-label="Delete branch"
                    title="Delete branch"
                  >
                    <IconDelete className="w-4 h-4" />
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Tooltip
      content={
        <div className="whitespace-pre text-xs">
          {summary.error ? (
            <div className="text-red-600 dark:text-red-400">{summary.error}</div>
          ) : summary.text ? (
            summary.text
          ) : (
            'Loading…'
          )}
        </div>
      }
      placement="bottom"
      anchorAs="div"
      disableClickToggle
    >
      {row}
    </Tooltip>
  )
}

function CurrentProjectView() {
  const { activeProject } = useProjectContext()
  const projectId = activeProject?.id
  const title = activeProject?.title
  const { unified } = useGit()
  const { branches, loading, error } = unified.get(projectId)

  const current = React.useMemo(() => branches?.find((b) => b.current), [branches])
  const others = React.useMemo(() => (branches || []).filter((b) => !b.current), [branches])

  const reload = React.useCallback(() => {
    void unified.reload(projectId)
  }, [unified, projectId])

  return (
    <div className="flex-1 min-h-0 min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-3">
        <div>Branches for the active project{title ? `: ${title}` : ''}.</div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && (
          <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
            <Spinner size={14} label="Loading branches..." />
          </div>
        )}
        {error && !loading && (
          <div className="p-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</div>
        )}
        {!loading && !error && (!branches || branches.length === 0) && (
          <div className="p-4 text-sm text-neutral-500">No branches found.</div>
        )}
        {!loading && !error && branches && branches.length > 0 && (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {current && (
              <div className="">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40">
                  Current branch
                </div>
                <UnifiedBranchItem
                  key={`${projectId}:${current.name}`}
                  projectId={projectId!}
                  branch={current}
                  projectTitle={title}
                  mode="current"
                  onAfterAction={reload}
                />
              </div>
            )}
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40">
              Other branches
            </div>
            {others.map((b) => (
              <UnifiedBranchItem key={`${projectId}:${b.name}`} projectId={projectId!} branch={b} projectTitle={title} onAfterAction={reload} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AllProjectsView() {
  const { projects } = useProjectContext()
  const { unified } = useGit()

  const anyLoading = projects.some((p) => unified.byProject[p.id]?.loading)
  const anyBranches = projects.some((p) => (unified.byProject[p.id]?.branches?.length ?? 0) > 0)

  return (
    <div className="flex-1 min-h-0 min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-3">
        <div>Branches across all projects.</div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {anyLoading && (
          <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
            <Spinner size={14} label="Loading branches..." />
          </div>
        )}

        {!anyLoading && !anyBranches && (
          <div className="p-4 text-sm text-neutral-500">No branches found across projects.</div>
        )}

        {projects.map((proj) => {
          const v = unified.byProject[proj.id]
          if (!v || v.loading || (v.branches?.length ?? 0) === 0) return null
          const curr = v.branches.find((b) => b.current)
          const rest = v.branches.filter((b) => !b.current)
          return (
            <div key={proj.id} className="">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40">
                {proj.title || proj.id}
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
                {curr && (
                  <>
                    <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40">
                      Current branch
                    </div>
                    <UnifiedBranchItem key={`${proj.id}:${curr.name}`} projectId={proj.id} branch={curr} mode="current" onAfterAction={() => unified.reload(proj.id)} />
                    <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40">
                      Other branches
                    </div>
                  </>
                )}
                {rest.map((b) => (
                  <UnifiedBranchItem key={`${proj.id}:${b.name}`} projectId={proj.id} branch={b} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GitView() {
  const [tab, setTab] = React.useState<'current' | 'all'>('current')

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Git</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              View branches with local/remote status and prepare merges
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4 flex-1 min-h-0 min-w-0">
        <div className="flex items-center gap-3">
          <SegmentedControl
            ariaLabel="Git view tabs"
            value={tab}
            onChange={(v) => setTab(v as 'current' | 'all')}
            options={[
              { value: 'current', label: 'Current project' },
              { value: 'all', label: 'All projects' },
            ]}
          />
        </div>

        {tab === 'current' ? <CurrentProjectView /> : <AllProjectsView />}
      </div>
    </div>
  )
}
