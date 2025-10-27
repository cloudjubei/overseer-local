import React from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Button } from '@renderer/components/ui/Button'
import { useProjectContext } from '@renderer/contexts/ProjectContext'
import { MergeReport, MergeReportFile, MergeResult, ConflictEntry } from 'thefactory-tools'
import { useGit } from '@renderer/contexts/GitContext'

export type GitMergeModalProps = {
  projectId: string
  repoPath: string
  baseRef: string
  branch: string
  storyId?: string
  featureId?: string
  onRequestClose: () => void
}

function DiffPatch({ patch }: { patch: string }) {
  const lines = React.useMemo(() => (patch || '').replace(/\r\n/g, '\n').split('\n'), [patch])
  return (
    <pre className="p-3 whitespace-pre-wrap">
      <code>
        {lines.map((line, idx) => {
          let cls = ''
          if (line.startsWith('+') && !line.startsWith('+++ ')) {
            cls = 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
          } else if (line.startsWith('-') && !line.startsWith('--- ')) {
            cls = 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }
          return (
            <span key={idx} className={`block px-2 py-0.5 ${cls}`}>
              {line || ' '}
            </span>
          )
        })}
      </code>
    </pre>
  )
}

function FileDiffItem({ file }: { file: MergeReportFile }) {
  return (
    <div className="border rounded-md border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <div className="px-3 py-2 text-xs flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/40">
        <div className="truncate font-mono">{file.path}</div>
        <div className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          {file.status}
          {typeof file.additions === 'number' || typeof file.deletions === 'number' ? (
            <span className="ml-2">
              +{file.additions || 0}/-{file.deletions || 0}
            </span>
          ) : null}
        </div>
      </div>
      <div className="max-h-64 overflow-auto text-xs font-mono">
        {file.binary ? (
          <div className="p-3 text-neutral-600 dark:text-neutral-400">Binary file diff not shown</div>
        ) : file.patch ? (
          <DiffPatch patch={file.patch} />
        ) : (
          <div className="p-3 text-neutral-600 dark:text-neutral-400">No patch available</div>
        )}
      </div>
    </div>
  )
}

function ConflictsPanel({
  conflicts,
  baseRef,
  branch,
}: {
  conflicts: ConflictEntry[]
  baseRef: string
  branch: string
}) {
  return (
    <div className="border rounded-md border-amber-300/50 dark:border-amber-600/40 overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
        Merge conflicts detected
      </div>
      <div className="p-3 text-sm">
        <div className="text-neutral-700 dark:text-neutral-300 mb-2">
          The merge of <span className="font-mono">{branch}</span> into <span className="font-mono">{baseRef}</span> has conflicts. Resolve them in your editor, then commit the merge.
        </div>
        <ul className="list-disc pl-5 text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
          {conflicts.map((c) => (
            <li key={c.path}>
              <span className="font-mono">{c.path}</span> — {c.type}
            </li>
          ))}
        </ul>
        <div className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
          Tip: Use your preferred diff/merge tool to resolve, then return here or close this dialog.
        </div>
      </div>
    </div>
  )
}

export default function GitMergeModal(props: GitMergeModalProps) {
  const { onRequestClose, projectId, repoPath, baseRef, branch, storyId, featureId } = props
  const { getProjectById } = useProjectContext()
  const project = getProjectById(projectId)
  const { getMergePlanOn, buildMergeReportOn, applyMergeOn } = useGit()

  const [loading, setLoading] = React.useState(true)
  const [report, setReport] = React.useState<MergeReport | undefined>(undefined)
  const [error, setError] = React.useState<string | undefined>(undefined)

  // Merge execution state
  const [merging, setMerging] = React.useState(false)
  const [mergeError, setMergeError] = React.useState<string | undefined>(undefined)
  const [mergeResult, setMergeResult] = React.useState<MergeResult | undefined>(undefined)

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(undefined)
      try {
        const plan = await getMergePlanOn(projectId, {
          sources: [branch],
          baseRef,
          includePatch: true,
        })
        const rep = await buildMergeReportOn(projectId, plan, { includePatch: true })
        if (!mounted) return
        setReport(rep)
      } catch (e: any) {
        if (!mounted) return
        console.warn('git merge report unavailable:', e)
        setError(e?.message || String(e))
        setReport(undefined)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [projectId, repoPath, baseRef, branch, getMergePlanOn, buildMergeReportOn])

  const onMerge = async () => {
    if (merging) return
    setMerging(true)
    setMergeError(undefined)
    setMergeResult(undefined)
    try {
      const res = await applyMergeOn(projectId, {
        sources: [branch],
        baseRef,
        allowFastForward: true,
      })
      setMergeResult(res)
      if (res?.ok && (!res.conflicts || res.conflicts.length === 0)) {
        // Success with no conflicts; close modal
        onRequestClose()
        return
      }
      // If not ok or conflicts exist, keep modal open and show conflict info below
    } catch (e: any) {
      console.error('Merge failed', e)
      setMergeError(e?.message || String(e))
    } finally {
      setMerging(false)
    }
  }

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
        <Button onClick={onMerge} loading={merging} disabled={merging}>
          {merging ? 'Merging…' : 'Merge'}
        </Button>
      </div>
    </div>
  )

  const hasConflicts = (mergeResult?.conflicts?.length || 0) > 0

  return (
    <Modal isOpen={true} onClose={onRequestClose} title={header} size="xl" footer={footer}>
      <div className="flex flex-col gap-4">
        {mergeError && (
          <div className="p-3 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap border border-red-200 dark:border-red-800 rounded-md">
            {mergeError}
          </div>
        )}
        {mergeResult && !mergeError && !hasConflicts && !mergeResult.ok && (
          <div className="p-3 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap border border-red-200 dark:border-red-800 rounded-md">
            {mergeResult.message || 'Merge failed'}
          </div>
        )}
        {hasConflicts && (
          <ConflictsPanel conflicts={mergeResult!.conflicts || []} baseRef={baseRef} branch={branch} />)
        }

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
