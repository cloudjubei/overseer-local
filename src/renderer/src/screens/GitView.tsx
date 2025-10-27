import React from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'
import Spinner from '../components/ui/Spinner'
import { GitProvider, useGit } from '../contexts/GitContext'
import { useProjectContext } from '../contexts/ProjectContext'
import { useNavigator } from '../navigation/Navigator'
import { Button } from '../components/ui/Button'
import Tooltip from '../components/ui/Tooltip'
import { IconMerge } from '../components/ui/icons/IconMerge'
import { IconDelete } from '../components/ui/icons/IconDelete'
import { IconBranch } from '../components/ui/icons/IconBranch'

function PendingItem({ item, projectTitle }: { item: any; projectTitle?: string }) {
  const { openModal } = useNavigator()
  const { applyMergeOn, getBranchDiffSummaryOn, deleteBranchOn } = useGit()
  const [merging, setMerging] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [summary, setSummary] = React.useState<{
    loaded: boolean
    error?: string
    text?: string
  }>({ loaded: false })

  const story = item.storyId ? ` • story ${item.storyId}` : ''
  const aheadBehind = `${item.ahead}↑ / ${item.behind}↓`

  const onQuickMerge = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (merging) return
    setMerging(true)
    try {
      const res = await applyMergeOn(item.projectId, {
        sources: [item.branch],
        baseRef: item.baseRef,
        allowFastForward: true,
      })
      if (!res?.ok || (res?.conflicts && res.conflicts.length > 0)) {
        // Open full merge modal to resolve
        openModal({
          type: 'git-merge',
          projectId: item.projectId,
          repoPath: item.repoPath,
          baseRef: item.baseRef,
          branch: item.branch,
          storyId: item.storyId,
          featureId: item.featureId,
        })
      }
    } catch (err) {
      console.error('Quick merge failed', err)
      // On error, open the merge modal for more context
      openModal({
        type: 'git-merge',
        projectId: item.projectId,
        repoPath: item.repoPath,
        baseRef: item.baseRef,
        branch: item.branch,
        storyId: item.storyId,
        featureId: item.featureId,
      })
    } finally {
      setMerging(false)
    }
  }

  const loadSummary = async () => {
    if (summary.loaded) return
    try {
      const diff = await getBranchDiffSummaryOn(item.projectId, {
        baseRef: item.baseRef,
        headRef: item.branch,
      })
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
    const ok = window.confirm(`Delete branch '${item.branch}'? This cannot be undone.`)
    if (!ok) return
    setDeleting(true)
    try {
      const res = await deleteBranchOn(item.projectId, item.branch)
      if (!res?.ok) {
        alert(`Failed to delete branch: ${res?.error || 'unknown error'}`)
      }
      // Monitor will update and remove the branch if needed
    } catch (err) {
      console.error('Delete branch failed', err)
      alert('Delete branch failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-900 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900/30 cursor-pointer"
      role="button"
      onClick={() =>
        openModal({
          type: 'git-merge',
          projectId: item.projectId,
          repoPath: item.repoPath,
          baseRef: item.baseRef,
          branch: item.branch,
          storyId: item.storyId,
          featureId: item.featureId,
        })
      }
    >
      <div className="min-w-0">
        <div className="font-medium truncate">{item.branch}</div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
          {projectTitle ? `${projectTitle} · ` : ''}
          base {item.baseRef}
          {story}
          {item.totals
            ? ` · +${item.totals.insertions}/-${item.totals.deletions} · ${item.totals.filesChanged} files`
            : ''}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <div className="text-xs text-neutral-700 dark:text-neutral-300">{aheadBehind}</div>
        <div className="flex items-center gap-1.5">
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
          >
            <span
              onMouseEnter={() => {
                // Preload summary when hovering
                loadSummary()
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="icon" aria-label="View changes">
                <IconBranch className="w-4 h-4" />
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            onClick={onQuickMerge}
            loading={merging}
            aria-label="Quick merge"
            title="Quick merge into base"
          >
            <IconMerge className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            loading={deleting}
            aria-label="Delete branch"
            title="Delete branch"
          >
            <IconDelete className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function CurrentProjectView() {
  const { loading, error, currentProject } = useGit()
  const { activeProject } = useProjectContext()
  const title = activeProject?.title

  return (
    <div className="flex-1 min-h-0 min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-3">
        <div>Pending branches for the active project{title ? `: ${title}` : ''}.</div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && (
          <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
            <Spinner size={14} label="Loading git status..." />
          </div>
        )}
        {error && !loading && (
          <div className="p-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
            {error}
          </div>
        )}
        {!loading && !error && activeProject && currentProject.pending.length === 0 && (
          <div className="p-4 text-sm text-neutral-500">
            No pending feature branches ahead of base.
          </div>
        )}
        {!loading && !error && activeProject && currentProject.pending.length > 0 && (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {currentProject.pending.map((p) => (
              <PendingItem key={`${p.projectId}:${p.branch}`} item={p} projectTitle={title} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AllProjectsView() {
  const { allProjects, loading, error } = useGit()
  const { projects } = useProjectContext()
  const titleById = React.useMemo(() => new Map(projects.map((p) => [p.id, p.title])), [projects])

  const anyPending = allProjects.some((p) => (p.pending?.length ?? 0) > 0)

  return (
    <div className="flex-1 min-h-0 min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-3">
        <div>Pending branches across all projects.</div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && (
          <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
            <Spinner size={14} label="Loading git status..." />
          </div>
        )}
        {error && !loading && (
          <div className="p-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {!loading && !error && !anyPending && (
          <div className="p-4 text-sm text-neutral-500">
            No pending feature branches across projects.
          </div>
        )}

        {!loading && !error && anyPending && (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {allProjects
              .filter((p) => (p.pending?.length ?? 0) > 0)
              .map((proj) => (
                <div key={proj.projectId} className="">
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40">
                    {titleById.get(proj.projectId) || proj.projectId}
                  </div>
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
                    {proj.pending.map((p) => (
                      <PendingItem key={`${p.projectId}:${p.branch}`} item={p} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
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
              View pending feature branches and prepare merges
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
