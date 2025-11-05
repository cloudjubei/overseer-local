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
import { useStories } from '../contexts/StoriesContext'

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

function AheadBehind({
  ahead = 0,
  behind = 0,
  totals,
}: {
  ahead?: number
  behind?: number
  totals?: { insertions: number; deletions: number }
}) {
  if (!ahead && !behind) return null
  const parts: React.ReactNode[] = []
  if (ahead > 0) {
    parts.push(
      <span key='ahead' className='text-emerald-600 dark:text-emerald-400'>
        {ahead}↑
      </span>,
    )
  }
  if (behind > 0) {
    if (parts.length > 0)
      parts.push(
        <span key='sep' className='text-neutral-600 dark:text-neutral-400'>
          {' '}
          /{' '}
        </span>,
      )
    parts.push(
      <span key='behind' className='text-red-600 dark:text-red-400'>
        {behind}↓
      </span>,
    )
  }
  return (
    <div className='text-xs text-neutral-700 dark:text-neutral-300 flex items-center gap-1'>
      <span>{parts}</span>
      {totals && (totals.insertions > 0 || totals.deletions > 0) ? (
        <span className='text-neutral-600 dark:text-neutral-400'>
          • +{totals.insertions}/-{totals.deletions}
        </span>
      ) : null}
    </div>
  )
}

function StatusChips({ b, showEqual }: { b: GitUnifiedBranch; showEqual?: boolean }) {
  const label = statusLabel(b)
  return (
    <div className='flex items-center gap-1 text-[10px] uppercase tracking-wide'>
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
      {showEqual ? (
        <span className='px-1.5 py-0.5 rounded border bg-blue-100/60 border-blue-300 text-neutral-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-neutral-300'>
          EQUAL
        </span>
      ) : null}
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
  equalToCurrent,
  currentName,
}: {
  projectId: string
  projectTitle?: string
  baseRef?: string
  branch: GitUnifiedBranch
  mode?: 'default' | 'current'
  onAfterAction?: () => void
  equalToCurrent?: boolean
  currentName?: string
}) {
  const { openModal } = useNavigator()
  const { pending } = useGit()
  const { resolveDependency } = useStories()
  const [deleting, setDeleting] = React.useState(false)
  const [summary, setSummary] = React.useState<{
    loaded: boolean
    error?: string
    text?: string
    totals?: { insertions: number; deletions: number }
  }>({ loaded: false })
  const [pushing, setPushing] = React.useState(false)
  const [pulling, setPulling] = React.useState(false)
  const [incoming, setIncoming] = React.useState<{
    loading: boolean
    error?: string
    totals?: { insertions: number; deletions: number }
  }>({ loading: false })

  // Detect when this row is the base branch while the current branch is different
  const isBaseBranchRowBehindCurrent = React.useMemo(() => {
    if (mode === 'current') return false
    if (!currentName) return false
    return branch.name === baseRef && currentName !== baseRef
  }, [mode, currentName, branch.name, baseRef])

  const [behindOfCurrent, setBehindOfCurrent] = React.useState<{
    loading: boolean
    error?: string
    count?: number
  }>({ loading: false })

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

  // Compute protection status for this branch (local and/or remote short names)
  const localShortName = (branch.name || '').replace(/^[^\/]+\//, '')
  const remoteShortName = (branch.remoteName || branch.name || '').replace(/^[^\/]+\//, '')
  const isProtected = isProtectedBranch(localShortName) || isProtectedBranch(remoteShortName)

  const headRef = React.useMemo(
    () => (branch.isLocal ? branch.name : branch.remoteName || branch.name),
    [branch.isLocal, branch.name, branch.remoteName],
  )

  const openMergeModal = (opts: { openConfirm: boolean }) => {
    if (!canQuickMerge || mode === 'current' || isBaseBranchRowBehindCurrent) return
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
    if (isBaseBranchRowBehindCurrent) return
    openMergeModal({ openConfirm: false })
  }

  const onFastMergeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    openMergeModal({ openConfirm: true })
  }

  const loadSummary = async () => {
    if (summary.loaded) return
    try {
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
      setSummary({
        loaded: true,
        text,
        totals: { insertions: diff.insertions, deletions: diff.deletions },
      })
    } catch (e) {
      setSummary({ loaded: true, error: (e as any)?.message || 'Could not load summary' })
    }
  }

  // Load incoming-only totals for current branch when upstream or a remote ref exists
  React.useEffect(() => {
    if (mode !== 'current') return

    const upstreamConfigured = !!branch.upstreamRemote && !!branch.upstreamBranch
    const hasRemoteName = !!branch.remoteName
    const canTry = upstreamConfigured || hasRemoteName
    if (!canTry) return

    // Prefer configured upstream, otherwise fall back to the discovered remote ref
    const remoteRef = upstreamConfigured
      ? `${branch.upstreamRemote}/${branch.upstreamBranch}`
      : (branch.remoteName as string)

    // If we can determine equality by sha, skip the request
    const localSha = branch.localSha
    const remoteSha = branch.remoteSha
    if (localSha && remoteSha && localSha === remoteSha) return

    if (incoming.loading || incoming.totals || incoming.error) return

    const run = async () => {
      try {
        setIncoming((s) => ({ ...s, loading: true }))
        const diff = await gitService.getBranchDiffSummary(projectId, {
          baseRef: branch.name,
          headRef: remoteRef,
          incomingOnly: true,
          includePatch: false,
        })
        setIncoming({
          loading: false,
          totals: { insertions: diff.insertions, deletions: diff.deletions },
        })
      } catch (e) {
        setIncoming({
          loading: false,
          error: (e as any)?.message || 'Failed to load incoming summary',
        })
      }
    }
    void run()
  }, [
    mode,
    projectId,
    branch.name,
    branch.upstreamRemote,
    branch.upstreamBranch,
    branch.remoteName,
    branch.localSha,
    branch.remoteSha,
  ])

  // Compute 'behind of current' when this row is the base branch while a different current exists
  React.useEffect(() => {
    if (!isBaseBranchRowBehindCurrent) return
    if (behindOfCurrent.loading || behindOfCurrent.count !== undefined || behindOfCurrent.error)
      return
    const run = async () => {
      try {
        setBehindOfCurrent({ loading: true })
        const commits = await gitService.selectCommits(projectId, {
          sources: [currentName as string],
          baseRef: branch.name,
          maxCount: 500,
        })
        setBehindOfCurrent({ loading: false, count: commits?.length || 0 })
      } catch (e) {
        setBehindOfCurrent({
          loading: false,
          error: (e as any)?.message || 'Failed to compute behind-of-current',
        })
      }
    }
    void run()
  }, [
    isBaseBranchRowBehindCurrent,
    behindOfCurrent.loading,
    behindOfCurrent.count,
    behindOfCurrent.error,
    projectId,
    currentName,
    branch.name,
  ])

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
      const ok = window.confirm(
        `Delete remote branch 'origin/${remoteShort}'? This cannot be undone.`,
      )
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
        if (!resLocal?.ok)
          alert(`Failed to delete local branch: ${resLocal?.error || 'unknown error'}`)
      }

      // Delete remote if remote-only or user opted to also delete
      if (branch.isRemote && (!branch.isLocal || deleteRemoteAlso)) {
        const short = (branch.remoteName || branch.name).replace(/^[^\/]+\//, '')
        const resRemote = await gitService.deleteRemoteBranch(projectId, short)
        if (!resRemote?.ok)
          alert(`Failed to delete remote branch: ${resRemote?.error || 'unknown error'}`)
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
      const res = await gitService.push(
        projectId,
        remoteAndBranch.remote,
        remoteAndBranch.remoteBranch,
      )
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
      const res = await gitService.pull(
        projectId,
        remoteAndBranch.remote,
        remoteAndBranch.remoteBranch,
      )
      if (!res?.ok) alert(`Pull failed: ${res?.error || 'unknown error'}`)
    } catch (err) {
      console.error('Pull failed', err)
      alert('Pull failed')
    } finally {
      setPulling(false)
      onAfterAction?.()
    }
  }

  // Adjust ahead/behind display: for base row behind current, show computed behind
  const ahead = isBaseBranchRowBehindCurrent ? 0 : branch.ahead ?? 0
  const behind = isBaseBranchRowBehindCurrent ? behindOfCurrent.count ?? 0 : branch.behind ?? 0
  const showPush = mode === 'current' && ahead > 0
  const showPull = mode === 'current' && behind > 0

  // Resolve pending feature/story refs for this base/head
  const pendingRefs = pending.get(projectId, baseRef, headRef)

  const onMouseEnterRow = () => {
    void loadSummary()
    if (!pendingRefs.loading && !pendingRefs.entries?.length) {
      void pending.load(projectId, baseRef, headRef)
    }
  }

  // Only show story info when resolvable
  const resolvablePendingEntries = React.useMemo(() => {
    const entries = pendingRefs.entries || []
    return entries.filter((e) => {
      const dep = e.featureId || e.storyId
      const r = resolveDependency(dep)
      return !('code' in (r as any))
    })
  }, [pendingRefs.entries, resolveDependency])

  const resolvableStoryId = React.useMemo(() => {
    if (!storyId) return undefined
    const r = resolveDependency(storyId)
    return 'code' in (r as any) ? undefined : storyId
  }, [storyId, resolveDependency])

  const row = (
    <div
      className={
        'flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-900 text-sm ' +
        (mode === 'current'
          ? 'bg-neutral-50/60 dark:bg-neutral-900/30'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/30')
      }
      role='button'
      onClick={onRowClick}
      onMouseEnter={onMouseEnterRow}
    >
      <div className='min-w-0'>
        <div className='font-medium truncate flex items-center gap-2'>
          <span className='truncate'>{branch.name}</span>
          <StatusChips b={branch} showEqual={mode !== 'current' && !!equalToCurrent} />
        </div>
        <div className='text-xs text-neutral-600 dark:text-neutral-400 truncate'>
          {projectTitle ? `${projectTitle} · ` : ''}
          base {baseRef}
          {(resolvablePendingEntries.length > 0) || resolvableStoryId ? (
            <span className='inline-flex items-center gap-1'>
              {' '}
              •
              <span
                onClick={(e) => e.stopPropagation()}
                className='inline-flex items-center gap-1 flex-wrap'
              >
                {resolvablePendingEntries.length > 0 ? (
                  resolvablePendingEntries.map((e, idx) => (
                    <DependencyBullet
                      key={`${e.storyId}:${e.featureId || 'story'}:${idx}`}
                      dependency={e.featureId || e.storyId}
                    />
                  ))
                ) : resolvableStoryId ? (
                  <DependencyBullet dependency={resolvableStoryId} />
                ) : null}
              </span>
            </span>
          ) : (
            ''
          )}
        </div>
      </div>
      <div className='shrink-0 flex items-center gap-3'>
        <AheadBehind
          ahead={ahead}
          behind={behind}
          totals={mode === 'current' ? incoming.totals : summary.totals}
        />
        <div className='flex items-center gap-1.5'>
          {mode === 'current' ? (
            <>
              {showPull && (
                <Tooltip content={'pull from remote'} placement='bottom'>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={onPull}
                      loading={pulling}
                      aria-label='Pull'
                      title='Pull from remote'
                    >
                      Pull
                    </Button>
                  </span>
                </Tooltip>
              )}
              {showPush && (
                <Tooltip content={'push to remote'} placement='bottom'>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={onPush}
                      loading={pushing}
                      aria-label='Push'
                      title='Push to remote'
                    >
                      Push
                    </Button>
                  </span>
                </Tooltip>
              )}
            </>
          ) : isBaseBranchRowBehindCurrent ? (
            <Tooltip
              content={
                behindOfCurrent.loading
                  ? 'Checking relationship to current...'
                  : 'Base branch is behind current and cannot be fast-merged here.'
              }
              placement='bottom'
            >
              <span className='text-xs text-neutral-500 dark:text-neutral-400'>
                {behindOfCurrent.count !== undefined
                  ? `${behindOfCurrent.count} commits behind current`
                  : 'Behind current'}
              </span>
            </Tooltip>
          ) : (
            <>
              <Tooltip content={canQuickMerge ? 'fast merge' : 'unavailable'} placement='bottom'>
                <span onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={onFastMergeClick}
                    disabled={!canQuickMerge}
                    aria-label='Fast merge'
                    title='fast merge'
                  >
                    <IconFastMerge className='w-4 h-4' />
                  </Button>
                </span>
              </Tooltip>
              <Tooltip
                content={
                  isProtected
                    ? 'protected branch'
                    : canDeleteLocal
                      ? 'delete local branch'
                      : canDeleteRemote
                        ? 'delete remote branch'
                        : 'cannot delete'
                }
                placement='bottom'
              >
                <span onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={onDelete}
                    disabled={isProtected || (!canDeleteLocal && !canDeleteRemote)}
                    loading={deleting}
                    aria-label='Delete branch'
                    title='Delete branch'
                  >
                    <IconDelete className='w-4 h-4' />
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
        <div className='whitespace-pre text-xs'>
          {summary.error ? (
            <div className='text-red-600 dark:text-red-400'>{summary.error}</div>
          ) : summary.text ? (
            summary.text
          ) : (
            'Loading…'
          )}
        </div>
      }
      placement='bottom'
      anchorAs='div'
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

  const isEqualToCurrent = React.useCallback(
    (b: GitUnifiedBranch): boolean => {
      if (!current) return false
      const currSha = current.localSha
      if (!currSha) return false
      // Equal if either local or remote sha of the row matches current local sha
      if (b.localSha && b.localSha === currSha) return true
      if (b.remoteSha && b.remoteSha === currSha) return true
      return false
    },
    [current],
  )

  return (
    <div className='flex-1 min-h-0 min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 flex flex-col'>
      <div className='px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-3'>
        <div>Branches for the active project{title ? `: ${title}` : ''}.</div>
      </div>
      <div className='flex-1 min-h-0 overflow-auto'>
        {loading && (
          <div className='p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2'>
            <Spinner size={14} label='Loading branches...' />
          </div>
        )}
        {error && !loading && (
          <div className='p-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap'>
            {error}
          </div>
        )}
        {!loading && !error && (!branches || branches.length === 0) && (
          <div className='p-4 text-sm text-neutral-500'>No branches found.</div>
        )}
        {!loading && !error && branches && branches.length > 0 && (
          <div className='divide-y divide-neutral-100 dark:divide-neutral-900'>
            {current && (
              <div className=''>
                <div className='px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40'>
                  Current branch
                </div>
                <UnifiedBranchItem
                  key={`${projectId}:${current.name}`}
                  projectId={projectId!}
                  branch={current}
                  projectTitle={title}
                  mode='current'
                  onAfterAction={reload}
                />
              </div>
            )}
            {others.length > 0 && (
              <>
                <div className='px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40'>
                  Other branches
                </div>
                {others.map((b) => (
                  <UnifiedBranchItem
                    key={`${projectId}:${b.name}`}
                    projectId={projectId!}
                    branch={b}
                    projectTitle={title}
                    onAfterAction={reload}
                    equalToCurrent={isEqualToCurrent(b)}
                    currentName={current?.name}
                  />
                ))}
              </>
            )}
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
    <div className='flex-1 min-h-0 min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 flex flex-col'>
      <div className='px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-3'>
        <div>Branches across all projects.</div>
      </div>
      <div className='flex-1 min-h-0 overflow-auto'>
        {anyLoading && (
          <div className='p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2'>
            <Spinner size={14} label='Loading branches...' />
          </div>
        )}

        {!anyLoading && !anyBranches && (
          <div className='p-4 text-sm text-neutral-500'>No branches found across projects.</div>
        )}

        {projects.map((proj) => {
          const v = unified.byProject[proj.id]
          if (!v || v.loading || (v.branches?.length ?? 0) === 0) return null
          const curr = v.branches.find((b) => b.current)
          const rest = v.branches.filter((b) => !b.current)

          const isEqualToCurrent = (b: GitUnifiedBranch): boolean => {
            if (!curr) return false
            const currSha = curr.localSha
            if (!currSha) return false
            if (b.localSha && b.localSha === currSha) return true
            if (b.remoteSha && b.remoteSha === currSha) return true
            return false
          }

          return (
            <div key={proj.id} className=''>
              <div className='px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40'>
                {proj.title || proj.id}
              </div>
              <div className='divide-y divide-neutral-100 dark:divide-neutral-900'>
                {curr && (
                  <>
                    <div className='px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40'>
                      Current branch
                    </div>
                    <UnifiedBranchItem
                      key={`${proj.id}:${curr.name}`}
                      projectId={proj.id}
                      branch={curr}
                      mode='current'
                      onAfterAction={() => unified.reload(proj.id)}
                    />
                    {rest.length > 0 && (
                      <div className='px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40'>
                        Other branches
                      </div>
                    )}
                  </>
                )}
                {rest.map((b) => (
                  <UnifiedBranchItem
                    key={`${proj.id}:${b.name}`}
                    projectId={proj.id}
                    branch={b}
                    equalToCurrent={isEqualToCurrent(b)}
                    currentName={curr?.name}
                  />
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
    <div className='flex flex-col flex-1 min-h-0 min-w-0 w-full overflow-hidden'>
      <div className='px-4 py-3 border-b border-neutral-200 dark:border-neutral-800'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <div className='text-lg font-semibold'>Git</div>
            <div className='text-sm text-neutral-600 dark:text-neutral-400'>
              View branches with local/remote status and prepare merges
            </div>
          </div>
        </div>
      </div>

      <div className='p-4 flex flex-col gap-4 flex-1 min-h-0 min-w-0'>
        <div className='flex items-center gap-3'>
          <SegmentedControl
            ariaLabel='Git view tabs'
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
