import { useState } from 'react'
import { useActiveProject, useProjects } from '@core/contexts/ProjectsContext'
import { useIngestion } from '@core/contexts/IngestionContext'
import type { IngestionJobState } from '@core/contexts/IngestionContext'
import { Alert } from 'thefactory-ui/web'
import { Button } from 'thefactory-ui/web'
import { Surface } from 'thefactory-ui/web'

export default function IngestionPanel() {
  const { jobs, startProjectIngest, startGlobalIngest, dismissJob } = useIngestion()
  const { projectId } = useActiveProject()
  const { projects } = useProjects()
  const [busyKind, setBusyKind] = useState<'project' | 'all' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const start = async (kind: 'project' | 'all') => {
    setError(null)
    setBusyKind(kind)
    try {
      if (kind === 'project') {
        if (!projectId) throw new Error('No active project')
        await startProjectIngest(projectId)
      } else {
        await startGlobalIngest()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start ingestion')
    } finally {
      setBusyKind(null)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold mb-1">Ingestion</h2>
      <p className="text-[12px] text-(--text-secondary)">
        Re-scan project sources to refresh embeddings and the document index. Runs server-side; you
        can leave this tab while it works.
      </p>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => start('project')}
          disabled={!projectId || busyKind !== null}
          loading={busyKind === 'project'}
        >
          Reindex this project
        </Button>
        <Button
          variant="secondary"
          onClick={() => start('all')}
          disabled={busyKind !== null}
          loading={busyKind === 'all'}
        >
          Reindex all ({projects.length})
        </Button>
      </div>

      {jobs.length > 0 && (
        <ul className="flex flex-col gap-2 mt-2">
          {jobs.map((job) => (
            <JobRow
              key={job.jobId}
              job={job}
              projectName={
                job.projectId
                  ? (projects.find((p) => p.id === job.projectId)?.title ?? job.projectId)
                  : 'All projects'
              }
              onDismiss={() => dismissJob(job.jobId)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function JobRow({
  job,
  projectName,
  onDismiss,
}: {
  job: IngestionJobState
  projectName: string
  onDismiss: () => void
}) {
  const isTerminal = job.status === 'finished' || job.status === 'error' || job.status === 'partial'
  const pct = job.total > 0 ? Math.min(100, Math.round((job.completed / job.total) * 100)) : null
  return (
    <Surface as="li" className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium truncate">{projectName}</span>
        <StatusPill status={job.status} />
        <span className="text-xs opacity-70 font-mono">
          {job.total > 0 ? `${job.completed} / ${job.total}` : `${job.completed} files`}
          {pct != null ? ` · ${pct}%` : ''}
          {job.upserted > 0 ? ` · ${job.upserted} upserted` : ''}
        </span>
        <span className="text-xs opacity-60 truncate flex-1" title={job.currentFile}>
          {job.currentFile ?? ''}
        </span>
        {isTerminal && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
      {pct != null && job.status === 'running' && (
        <div className="h-1 rounded overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
          <div
            className="h-full transition-all"
            style={{ width: `${pct}%`, background: 'var(--color-brand-700)' }}
          />
        </div>
      )}
      {job.error && (
        <p className="text-xs" style={{ color: 'var(--color-red-700)' }}>
          {job.error}
        </p>
      )}
      {job.result && (
        <p className="text-xs opacity-70">
          Upserted {job.result.upserted}, skipped {job.result.skipped}, failed {job.result.failed}{' '}
          in {Math.round(job.result.durationMs / 100) / 10}s.
        </p>
      )}
    </Surface>
  )
}

function StatusPill({ status }: { status: IngestionJobState['status'] }) {
  const { label, bg, fg } = STATUS_STYLE[status]
  return (
    <span
      className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  )
}

const STATUS_STYLE: Record<IngestionJobState['status'], { label: string; bg: string; fg: string }> =
  {
    pending: {
      label: 'Pending',
      bg: 'var(--surface-muted)',
      fg: 'var(--text-muted)',
    },
    running: {
      label: 'Running',
      bg: 'var(--color-brand-50)',
      fg: 'var(--color-brand-700)',
    },
    finished: {
      label: 'Done',
      bg: 'var(--color-green-50)',
      fg: 'var(--color-green-700)',
    },
    partial: {
      label: 'Done (errors)',
      bg: 'var(--color-orange-50)',
      fg: 'var(--color-orange-700)',
    },
    error: {
      label: 'Failed',
      bg: 'var(--color-red-50)',
      fg: 'var(--color-red-700)',
    },
  }
