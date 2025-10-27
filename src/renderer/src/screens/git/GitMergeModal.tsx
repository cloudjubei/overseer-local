import React from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Button } from '@renderer/components/ui/Button'
import { useProjectContext } from '@renderer/contexts/ProjectContext'
import type { MergeReport, MergeReportFile } from '../../../../logic/git/gitTypes.copy'

export type GitMergeModalProps = {
  projectId: string
  repoPath: string
  baseRef: string
  branch: string
  storyId?: string
  featureId?: string
  onRequestClose: () => void
}

// Attempt to call optional renderer-provided git service methods without hard dependency
async function tryBuildMergeReport(args: {
  projectId: string
  repoPath: string
  baseRef: string
  sources: string[]
  includePatch?: boolean
}): Promise<MergeReport | undefined> {
  const anyWin: any = window as any
  const svc = anyWin.gitService
  if (!svc) return undefined
  try {
    // Prefer buildMergeReport(plan) path via getMergePlan + buildMergeReport if available
    if (typeof svc.getMergePlan === 'function' && typeof svc.buildMergeReport === 'function') {
      const plan = await svc.getMergePlan(args.projectId, {
        sources: args.sources,
        baseRef: args.baseRef,
        includePatch: true,
      })
      const report = await svc.buildMergeReport(args.projectId, plan, { includePatch: true })
      return report as MergeReport
    }
    // Fallback: direct helper if exposed
    if (typeof svc.buildMergeReport === 'function') {
      const report = await svc.buildMergeReport(args.projectId, {
        repoPath: args.repoPath,
        baseRef: args.baseRef,
        sources: args.sources,
        includePatch: true,
      })
      return report as MergeReport
    }
  } catch (e) {
    console.warn('git merge report unavailable:', e)
    return undefined
  }
  return undefined
}

function FileDiffItem({ file }: { file: MergeReportFile }) {
  return (
    <div className="border rounded-md border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <div className="px-3 py-2 text-xs flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/40">
        <div className="truncate font-mono">{file.path}</div>
        <div className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          {file.status}
          {typeof file.additions === 'number' || typeof file.deletions === 'number' ? (
            <span className="ml-2">+{file.additions || 0}/-{file.deletions || 0}</span>
          ) : null}
        </div>
      </div>
      <div className="max-h-64 overflow-auto text-xs font-mono">
        {file.binary ? (
          <div className="p-3 text-neutral-600 dark:text-neutral-400">Binary file diff not shown</div>
        ) : file.patch ? (
          <pre className="p-3 whitespace-pre-wrap"><code>{file.patch}</code></pre>
        ) : (
          <div className="p-3 text-neutral-600 dark:text-neutral-400">No patch available</div>
        )}
      </div>
    </div>
  )
}

export default function GitMergeModal(props: GitMergeModalProps) {
  const { onRequestClose, projectId, repoPath, baseRef, branch, storyId, featureId } = props
  const { getProjectById } = useProjectContext()
  const project = getProjectById(projectId)

  const [loading, setLoading] = React.useState(true)
  const [report, setReport] = React.useState<MergeReport | undefined>(undefined)
  const [error, setError] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(undefined)
      const rep = await tryBuildMergeReport({
        projectId,
        repoPath,
        baseRef,
        sources: [branch],
        includePatch: true,
      })
      if (!mounted) return
      setReport(rep)
      setLoading(false)
    })().catch((e) => {
      if (!mounted) return
      setError(e?.message || String(e))
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [projectId, repoPath, baseRef, branch])

  const header = (
    <div className="flex items-center gap-3">
      <div className="flex flex-col">
        <div className="text-base font-semibold">Prepare merge</div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400">
          {project?.title || projectId} · base {baseRef} · source {branch}
          {storyId ? ` · story ${storyId}` : ''}
          {featureId ? ` · feature ${featureId}` : ''}
        </div>
      </div>
    </div>
  )

  const footer = (
    <div className="flex items-center justify-between gap-2 w-full">
      <div className="text-xs text-neutral-600 dark:text-neutral-400">
        {report?.totals
          ? `+${report.totals.insertions}/-${report.totals.deletions} · ${report.totals.filesChanged} files`
          : 'Totals unavailable'}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onRequestClose} variant="secondary">
          Close
        </Button>
        <Button disabled title="Merge flow coming soon">Merge</Button>
      </div>
    </div>
  )

  return (
    <Modal isOpen={true} onClose={onRequestClose} title={header} size="xl" footer={footer}>
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-sm font-medium mb-2">Changes</div>
          {loading && (
            <div className="p-3 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
              <Spinner size={14} label="Loading diff preview..." />
            </div>
          )}
          {!loading && error && (
            <div className="p-3 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</div>
          )}
          {!loading && !error && (!report || report.files.length === 0) && (
            <div className="p-3 text-sm text-neutral-600 dark:text-neutral-400">
              Diff preview unavailable. You can still proceed to merge.
            </div>
          )}
          {!loading && !error && report && report.files.length > 0 && (
            <div className="flex flex-col gap-3">
              {report.files.map((f: MergeReportFile) => (
                <FileDiffItem key={f.path} file={f} />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border rounded-md p-3 border-neutral-200 dark:border-neutral-800">
            <div className="text-sm font-medium mb-1">Compilation Impact</div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">Not available</div>
          </div>
          <div className="border rounded-md p-3 border-neutral-200 dark:border-neutral-800">
            <div className="text-sm font-medium mb-1">Tests Impact</div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">Not available</div>
          </div>
          <div className="border rounded-md p-3 border-neutral-200 dark:border-neutral-800">
            <div className="text-sm font-medium mb-1">Diff Coverage</div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">Not available</div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
