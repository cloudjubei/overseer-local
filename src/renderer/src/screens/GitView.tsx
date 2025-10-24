import React from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'
import { Button } from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { GitProvider, useGit } from '../contexts/GitContext'
import { useProjectContext } from '../contexts/ProjectContext'

function PendingItem({
  item,
  projectTitle,
}: {
  item: import('../contexts/GitContext').PendingBranchSummary
  projectTitle?: string
}) {
  const story = item.storyId ? ` • story ${item.storyId}` : ''
  const aheadBehind = `${item.ahead}↑ / ${item.behind}↓`
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-900 text-sm">
      <div className="min-w-0">
        <div className="font-medium truncate">{item.branch}</div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
          {projectTitle ? `${projectTitle} · ` : ''}
          base {item.baseRef}
          {story}
          {item.totals ? ` · +${item.totals.insertions}/-${item.totals.deletions} · ${item.totals.filesChanged} files` : ''}
        </div>
      </div>
      <div className="shrink-0 text-xs text-neutral-700 dark:text-neutral-300">{aheadBehind}</div>
    </div>
  )
}

function CurrentProjectView() {
  const { currentProject, loading, error, refresh } = useGit()
  const { projects } = useProjectContext()
  const title = currentProject ? projects.find((p) => p.id === currentProject.projectId)?.title : undefined

  return (
    <div className="flex-1 min-h-0 min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-3">
        <div>Pending branches for the active project{title ? `: ${title}` : ''}.</div>
        <div className="ml-auto">
          <Button size="sm" onClick={() => refresh()} variant="secondary">
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && (
          <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
            <Spinner size={14} label="Loading git status..." />
          </div>
        )}
        {error && !loading && (
          <div className="p-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</div>
        )}
        {!loading && !error && currentProject && currentProject.pending.length === 0 && (
          <div className="p-4 text-sm text-neutral-500">No pending feature branches ahead of base.</div>
        )}
        {!loading && !error && currentProject && currentProject.pending.length > 0 && (
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
  const { allProjects, loading, error, refresh } = useGit()
  const { projects } = useProjectContext()
  const titleById = React.useMemo(() => new Map(projects.map((p) => [p.id, p.title])), [projects])

  const anyPending = allProjects.some((p) => (p.pending?.length ?? 0) > 0)

  return (
    <div className="flex-1 min-h-0 min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-3">
        <div>Pending branches across all projects.</div>
        <div className="ml-auto">
          <Button size="sm" onClick={() => refresh()} variant="secondary">
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && (
          <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
            <Spinner size={14} label="Loading git status..." />
          </div>
        )}
        {error && !loading && (
          <div className="p-4 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</div>
        )}

        {!loading && !error && !anyPending && (
          <div className="p-4 text-sm text-neutral-500">No pending feature branches across projects.</div>
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

function GitInner() {
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

export default function GitView() {
  return (
    <GitProvider>
      <GitInner />
    </GitProvider>
  )
}
