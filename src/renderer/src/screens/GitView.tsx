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

function statusLabel(b: GitUnifiedBranch): string {
  if (b.current) return 'current'
  if (b.isLocal && b.isRemote) return 'tracked'
  if (b.isLocal && !b.isRemote) return 'local only'
  if (!b.isLocal && b.isRemote) return 'remote only'
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
      {b.upstreamRemote && b.upstreamBranch && (
        <span className="px-1.5 py-0.5 rounded border bg-neutral-50 border-neutral-200 text-neutral-600 dark:bg-neutral-900/30 dark:border-neutral-800 dark:text-neutral-300">
          {`${b.upstreamRemote}/${b.upstreamBranch}`}
        </span>
      )}
    </div>
  )
}

function UnifiedBranchItem({
  projectId,
  projectTitle,
  baseRef = 'main',
  branch,
}: {
  projectId: string
  projectTitle?: string
  baseRef?: string
  branch: GitUnifiedBranch
}) {
  const { openModal } = useNavigator()
  const [deleting, setDeleting] = React.useState(false)
  const [summary, setSummary] = React.useState<{ loaded: boolean; error?: string; text?: string }>(
    { loaded: false },
  )

  const storyId = getStoryId(branch)

  const canQuickMerge = branch.isLocal || !!branch.remoteName
  const canDeleteLocal = branch.isLocal
  const canDeleteRemote = branch.isRemote && !branch.isLocal

  const onQuickMerge = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canQuickMerge) return
    openModal({
      type: 'git-merge',
      projectId,
      repoPath: '', // unknown at renderer; backend infers
      baseRef,
      branch: branch.isLocal ? branch.name : branch.remoteName || branch.name,
      storyId,
    })
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
    const ok = window.confirm(`Delete branch '${displayName}'? This cannot be undone.`)
    if (!ok) return
    setDeleting(true)
    try {
      if (canDeleteLocal) {
        const res = await gitService.deleteBranch(projectId, branch.name)
        if (!res?.ok) alert(`Failed to delete branch: ${res?.error || 'unknown error'}`)
      } else if (canDeleteRemote) {
        const short = branch.remoteName?.replace(/^[^/]+\//, '') || branch.name
        const res = await gitService.deleteRemoteBranch(projectId, short)
        if (!res?.ok) alert(`Failed to delete remote branch: ${res?.error || 'unknown error'}`)
      } else {
        alert('This branch cannot be deleted from here.')
      }
    } catch (err) {
      console.error('Delete branch failed', err)
      alert('Delete branch failed')
    } finally {
      setDeleting(false)
    }
  }

  const row = (
    <div
      className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-900 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900/30 cursor-pointer"
      role="button"
      onClick={onQuickMerge}
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
          {storyId ? ` • story ${storyId}` : ''}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <AheadBehind b={branch} />
        <div className="flex items-center gap-1.5">
          <Tooltip content={canQuickMerge ? 'fast merge' : 'unavailable'} placement="bottom">
            <span onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onQuickMerge}
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

function useUnifiedBranches(projectId?: string) {
  const [branches, setBranches] = React.useState<GitUnifiedBranch[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>(undefined)

  const load = React.useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(undefined)
    try {
      const list = await gitService.listUnifiedBranches(projectId)
      // Sort: current first, then tracked, then locals, then remotes; alpha by name
      const sorted = [...list].sort((a, b) => {
        if (a.current && !b.current) return -1
        if (b.current && !a.current) return 1
        const aScore = a.isLocal && a.isRemote ? 0 : a.isLocal ? 1 : 2
        const bScore = b.isLocal && b.isRemote ? 0 : b.isLocal ? 1 : 2
        if (aScore !== bScore) return aScore - bScore
        return a.name.localeCompare(b.name)
      })
      setBranches(sorted)
    } catch (e) {
      setError((e as any)?.message || 'Failed to list branches')
      setBranches([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  React.useEffect(() => {
    void load()
  }, [load])

  return { branches, loading, error, reload: load }
}

function CurrentProjectView() {
  const { activeProject } = useProjectContext()
  const projectId = activeProject?.id
  const title = activeProject?.title
  const { branches, loading, error } = useUnifiedBranches(projectId)

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
            {branches.map((b) => (
              <UnifiedBranchItem key={`${projectId}:${b.name}`} projectId={projectId!} branch={b} projectTitle={title} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AllProjectsView() {
  const { projects } = useProjectContext()
  const [data, setData] = React.useState<Record<string, { loading: boolean; error?: string; branches: GitUnifiedBranch[] }>>({})

  React.useEffect(() => {
    let cancelled = false
    async function loadAll() {
      const entries: Array<[string, { loading: boolean; error?: string; branches: GitUnifiedBranch[] }]> = []
      for (const p of projects) {
        try {
          entries.push([p.id, { loading: true, branches: [] }])
          const list = await gitService.listUnifiedBranches(p.id)
          const sorted = [...list].sort((a, b) => {
            if (a.current && !b.current) return -1
            if (b.current && !a.current) return 1
            const aScore = a.isLocal && a.isRemote ? 0 : a.isLocal ? 1 : 2
            const bScore = b.isLocal && b.isRemote ? 0 : b.isLocal ? 1 : 2
            if (aScore !== bScore) return aScore - bScore
            return a.name.localeCompare(b.name)
          })
          entries.push([p.id, { loading: false, branches: sorted }])
        } catch (e) {
          entries.push([p.id, { loading: false, error: (e as any)?.message || 'Failed to list branches', branches: [] }])
        }
      }
      if (!cancelled) {
        const next: Record<string, { loading: boolean; error?: string; branches: GitUnifiedBranch[] }> = {}
        for (const [id, v] of entries) next[id] = v
        setData(next)
      }
    }
    void loadAll()
    return () => {
      cancelled = true
    }
  }, [projects])

  const anyLoading = projects.some((p) => data[p.id]?.loading)
  const anyBranches = projects.some((p) => (data[p.id]?.branches?.length ?? 0) > 0)

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
          const v = data[proj.id]
          if (!v || v.loading || (v.branches?.length ?? 0) === 0) return null
          return (
            <div key={proj.id} className="">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40">
                {proj.title || proj.id}
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
                {v.branches.map((b) => (
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
