import React from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Button } from '@renderer/components/ui/Button'
import { useProjectContext } from '@renderer/contexts/ProjectContext'
import { MergeReport, MergeReportFile, MergeResult, ConflictEntry, CoverageResult } from 'thefactory-tools'
import { useGit } from '@renderer/contexts/GitContext'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { factoryTestsService } from '@renderer/services/factoryTestsService'

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

// ============ Analysis helpers ============
function normalizePath(p: string): string {
  let out = p.replace(/\\/g, '/').replace(/^\.[/\\]/, '')
  const m = out.match(/(?:^|.*?)(src\/.*)$/)
  if (m && m[1]) return m[1]
  return out.replace(/^\//, '')
}

function parseAddedLineNumbersFromPatch(patch?: string): number[] {
  if (!patch) return []
  const lines = patch.replace(/\r\n/g, '\n').split('\n')
  let currentNewLine = 0
  const added: number[] = []
  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Example: @@ -aStart,aCount +bStart,bCount @@
      const m = line.match(/\+([0-9]+)(?:,([0-9]+))?\s*@@/)
      if (m) {
        currentNewLine = parseInt(m[1], 10) - 1 // will increment before checking content
      }
      continue
    }
    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      continue
    }
    if (line.startsWith('+')) {
      currentNewLine += 1
      // treat any '+' line as code; keep simple heuristic
      added.push(currentNewLine)
    } else if (line.startsWith('-')) {
      // removed line affects old file only; do not change new file line
      continue
    } else {
      // context line
      currentNewLine += 1
    }
  }
  return added
}

function pctColor(p: number) {
  if (p >= 90) return 'text-green-700 dark:text-green-300'
  if (p >= 75) return 'text-amber-700 dark:text-amber-300'
  if (p >= 50) return 'text-orange-700 dark:text-orange-300'
  return 'text-red-700 dark:text-red-300'
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden">
      <div className={`h-full ${value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

// ============ Main component ============
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

  // Analysis tab state
  const [activeTab, setActiveTab] = React.useState<'compilation' | 'tests' | 'coverage'>('compilation')

  // Compilation impact (heuristic)
  const [compilationInfo, setCompilationInfo] = React.useState<{
    summary: string
    details: Array<{ path: string; risk: 'low' | 'medium' | 'high'; reason: string }>
  } | null>(null)

  // Tests impact (heuristic mapping of changed files to likely tests)
  const [testsImpact, setTestsImpact] = React.useState<{
    impacted: string[]
    totalCatalog: number
  } | null>(null)
  const [testsImpactError, setTestsImpactError] = React.useState<string | null>(null)

  // Diff coverage analysis
  const [coverageLoading, setCoverageLoading] = React.useState(false)
  const [coverageError, setCoverageError] = React.useState<string | null>(null)
  const [diffCoverage, setDiffCoverage] = React.useState<
    | {
        totalAdded: number
        covered: number
        pct: number
        perFile: Array<{ path: string; added: number; covered: number; pct: number }>
      }
    | null
  >(null)

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

  // Build compilation impact heuristic from report
  React.useEffect(() => {
    if (!report) {
      setCompilationInfo(null)
      return
    }
    const details: Array<{ path: string; risk: 'low' | 'medium' | 'high'; reason: string }> = []
    const criticalNames = ['package.json', 'tsconfig.json', 'tsconfig.base.json', 'vite.config', 'webpack.config']

    for (const f of report.files) {
      const p = f.path
      const lower = p.toLowerCase()
      if (criticalNames.some((name) => lower.includes(name))) {
        details.push({ path: p, risk: 'high', reason: 'Build configuration change' })
        continue
      }
      if (p.endsWith('.d.ts')) {
        details.push({ path: p, risk: 'high', reason: 'Type definition change can cascade' })
        continue
      }
      if (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js') || p.endsWith('.jsx')) {
        // Heuristic based on additions/deletions
        const churn = (f.additions || 0) + (f.deletions || 0)
        const risk: 'low' | 'medium' | 'high' = churn > 200 ? 'high' : churn > 50 ? 'medium' : 'low'
        details.push({ path: p, risk, reason: `Source change (+${f.additions || 0}/-${f.deletions || 0})` })
        continue
      }
      if (p.endsWith('.json') || p.endsWith('.yaml') || p.endsWith('.yml')) {
        details.push({ path: p, risk: 'medium', reason: 'Configuration/content change' })
        continue
      }
      // default low
      details.push({ path: p, risk: 'low', reason: 'Non-code change' })
    }

    const counts = details.reduce(
      (acc, d) => {
        acc[d.risk] += 1
        return acc
      },
      { low: 0, medium: 0, high: 0 } as Record<'low' | 'medium' | 'high', number>,
    )
    const summary = `Risk estimate · High ${counts.high} · Medium ${counts.medium} · Low ${counts.low} (no compile adapter configured)`
    setCompilationInfo({ summary, details })
  }, [report])

  // Compute tests impact when the tab is first shown or report changes
  React.useEffect(() => {
    let cancelled = false
    async function run() {
      if (activeTab !== 'tests') return
      if (!projectId || !report) {
        setTestsImpact(null)
        return
      }
      setTestsImpactError(null)
      try {
        const catalog = await factoryTestsService.listTests(projectId)
        if (cancelled) return
        const testsList = (catalog || []).map((t: any) => String((t && (t.name || t.path || t.file || t.id)) ?? ''))
        const testSet = new Set<string>()
        const changed = report.files.map((f) => normalizePath(f.path))

        for (const test of testsList) {
          const tnorm = normalizePath(test)
          const base = tnorm.split('/').pop() || tnorm
          const stem = base.replace(/\.(spec|test)\.[a-z0-9]+$/i, '')
          // heuristic: match if filename stem or any directory segment overlaps
          for (const ch of changed) {
            const chBase = ch.split('/').pop() || ch
            const chStem = chBase.replace(/\.[a-z0-9]+$/i, '')
            if (tnorm.includes(chStem) || ch.includes(stem)) {
              testSet.add(test)
              break
            }
          }
        }
        setTestsImpact({ impacted: Array.from(testSet).slice(0, 50), totalCatalog: testsList.length })
      } catch (e: any) {
        if (!cancelled) setTestsImpactError(e?.message || String(e))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [activeTab, projectId, report])

  // Compute diff coverage when the tab is shown
  React.useEffect(() => {
    let cancelled = false
    async function compute() {
      if (activeTab !== 'coverage') return
      if (!projectId || !report) {
        setDiffCoverage(null)
        return
      }
      setCoverageLoading(true)
      setCoverageError(null)
      try {
        const cov: CoverageResult | undefined = await factoryTestsService.getLastCoverage(projectId)
        if (cancelled) return
        if (!cov || !cov.files || Object.keys(cov.files).length === 0) {
          setCoverageError('No coverage data available. Run coverage in Tests view.')
          setDiffCoverage(null)
          setCoverageLoading(false)
          return
        }

        // Build map from normalized rel path -> uncovered lines set and total lines covered include pct_lines
        const coverByRel: Record<string, { uncovered: Set<number>; pct_lines: number | null }> = {}
        for (const [file, stats] of Object.entries<any>(cov.files || {})) {
          const rel = normalizePath(file)
          const uncovered = new Set<number>(Array.isArray((stats as any).uncovered_lines) ? (stats as any).uncovered_lines as number[] : [])
          const pct = typeof (stats as any).pct_lines === 'number' ? (stats as any).pct_lines : null
          coverByRel[rel] = { uncovered, pct_lines: pct }
        }

        let totalAdded = 0
        let covered = 0
        const perFile: Array<{ path: string; added: number; covered: number; pct: number }> = []

        for (const f of report.files) {
          if (f.binary) continue
          const addedLines = parseAddedLineNumbersFromPatch(f.patch)
          if (addedLines.length === 0) continue
          const rel = normalizePath(f.path)
          const cover = coverByRel[rel]
          let fileCovered = 0
          if (cover) {
            for (const ln of addedLines) {
              if (!cover.uncovered.has(ln)) fileCovered += 1
            }
          }
          const fileTotal = addedLines.length
          totalAdded += fileTotal
          covered += fileCovered
          const pct = fileTotal > 0 ? (fileCovered / fileTotal) * 100 : 0
          perFile.push({ path: f.path, added: fileTotal, covered: fileCovered, pct })
        }

        const pct = totalAdded > 0 ? (covered / totalAdded) * 100 : 0
        setDiffCoverage({ totalAdded, covered, pct, perFile })
      } catch (e: any) {
        if (!cancelled) setCoverageError(e?.message || String(e))
      } finally {
        if (!cancelled) setCoverageLoading(false)
      }
    }
    compute()
    return () => {
      cancelled = true
    }
  }, [activeTab, projectId, report])

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

  const AnalysisTabs = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <SegmentedControl
          ariaLabel="Merge analysis tabs"
          value={activeTab}
          onChange={(v) => setActiveTab(v as any)}
          options={[
            { value: 'compilation', label: 'Compilation Impact' },
            { value: 'tests', label: 'Tests Impact' },
            { value: 'coverage', label: 'Diff Coverage' },
          ]}
        />
      </div>

      {/* Compilation Impact */}
      {activeTab === 'compilation' && (
        <div className="border rounded-md p-3 border-neutral-200 dark:border-neutral-800">
          <div className="text-sm font-medium mb-2">Compilation Impact</div>
          {!report && loading && (
            <div className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
              <Spinner size={14} label="Analyzing..." />
            </div>
          )}
          {report && compilationInfo && (
            <div className="space-y-3">
              <div className="text-xs text-neutral-700 dark:text-neutral-300">{compilationInfo.summary}</div>
              <div className="max-h-48 overflow-auto divide-y divide-neutral-100 dark:divide-neutral-900">
                {compilationInfo.details.map((d, idx) => (
                  <div key={idx} className="py-1.5 flex items-center justify-between gap-3">
                    <div className="text-xs font-mono truncate">{d.path}</div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      <span
                        className={
                          d.risk === 'high'
                            ? 'text-red-600 dark:text-red-400'
                            : d.risk === 'medium'
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-neutral-500'
                        }
                      >
                        {d.risk.toUpperCase()}
                      </span>
                      <span className="ml-2">{d.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-neutral-500">Heuristic only. Build adapters can refine this in future.</div>
            </div>
          )}
          {!report && !loading && (
            <div className="text-xs text-neutral-500">Report unavailable.</div>
          )}
        </div>
      )}

      {/* Tests Impact */}
      {activeTab === 'tests' && (
        <div className="border rounded-md p-3 border-neutral-200 dark:border-neutral-800">
          <div className="text-sm font-medium mb-2">Tests Impact</div>
          {!report && loading && (
            <div className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
              <Spinner size={14} label="Analyzing..." />
            </div>
          )}
          {testsImpactError && (
            <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{testsImpactError}</div>
          )}
          {report && !testsImpactError && testsImpact && (
            <div className="space-y-2">
              <div className="text-xs text-neutral-700 dark:text-neutral-300">
                {testsImpact.impacted.length} potential test{testsImpact.impacted.length === 1 ? '' : 's'} may be affected out of {testsImpact.totalCatalog}.
              </div>
              {testsImpact.impacted.length === 0 ? (
                <div className="text-xs text-neutral-500">No likely impacted tests detected.</div>
              ) : (
                <div className="max-h-48 overflow-auto">
                  <ul className="list-disc pl-5 text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
                    {testsImpact.impacted.map((t, i) => (
                      <li key={i} className="truncate" title={t}>
                        <span className="font-mono">{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-[11px] text-neutral-500">Heuristic mapping. Open Tests view to run targeted tests.</div>
            </div>
          )}
        </div>
      )}

      {/* Diff Coverage */}
      {activeTab === 'coverage' && (
        <div className="border rounded-md p-3 border-neutral-200 dark:border-neutral-800">
          <div className="text-sm font-medium mb-2">Diff Coverage</div>
          {coverageError && (
            <div className="text-xs text-amber-700 dark:text-amber-300 whitespace-pre-wrap">{coverageError}</div>
          )}
          {coverageLoading && (
            <div className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
              <Spinner size={14} label="Computing diff coverage..." />
            </div>
          )}
          {!coverageLoading && !coverageError && diffCoverage && (
            <div className="space-y-3">
              <div className="text-xs text-neutral-700 dark:text-neutral-300 flex items-center gap-3">
                <div className={`text-sm font-medium ${pctColor(diffCoverage.pct)}`}>
                  {diffCoverage.pct.toFixed(1)}% covered
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  {diffCoverage.covered}/{diffCoverage.totalAdded} changed lines covered
                </div>
              </div>
              <ProgressBar value={diffCoverage.pct} />
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="text-neutral-600 dark:text-neutral-400">
                    <tr>
                      <th className="text-left px-2 py-1">File</th>
                      <th className="text-right px-2 py-1">Changed</th>
                      <th className="text-right px-2 py-1">Covered</th>
                      <th className="text-right px-2 py-1">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffCoverage.perFile.length === 0 ? (
                      <tr>
                        <td className="px-2 py-2 text-neutral-500" colSpan={4}>
                          No added lines detected in patch.
                        </td>
                      </tr>
                    ) : (
                      diffCoverage.perFile.map((r, idx) => (
                        <tr key={idx} className="border-t border-neutral-100 dark:border-neutral-900">
                          <td className="px-2 py-1 font-mono truncate" title={r.path}>{r.path}</td>
                          <td className="px-2 py-1 text-right">{r.added}</td>
                          <td className="px-2 py-1 text-right">{r.covered}</td>
                          <td className={`px-2 py-1 text-right ${pctColor(r.pct)}`}>{r.pct.toFixed(1)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="text-[11px] text-neutral-500">Based on last coverage run. Run coverage again in Tests view for up-to-date metrics.</div>
            </div>
          )}
        </div>
      )}
    </div>
  )

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

        {AnalysisTabs}
      </div>
    </Modal>
  )
}
