import React from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Button } from '@renderer/components/ui/Button'
import { useProjectContext } from '@renderer/contexts/ProjectContext'
import {
  GitMergeReport,
  GitMergeReportFile,
  GitMergeResult,
  GitConflictEntry,
  CoverageResult,
} from 'thefactory-tools'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { factoryTestsService } from '@renderer/services/factoryTestsService'
import { gitService } from '@renderer/services/gitService'
import { IconFastMerge } from '@renderer/components/ui/icons/Icons'
import { IconChevron } from '@renderer/components/ui/icons/IconChevron'
import Tooltip from '@renderer/components/ui/Tooltip'
import { useGit } from '@renderer/contexts/GitContext'
import {
  IconFileAdded,
  IconFileDeleted,
  IconFileModified,
} from '@renderer/components/ui/icons/Icons'
import MergeConflictResolver from '@renderer/screens/git/MergeConflictResolver'
import { StructuredUnifiedDiff, IntraMode } from '@renderer/components/chat/tool-popups/diffUtils'

export type GitMergeModalProps = {
  projectId: string
  repoPath: string
  baseRef: string
  branch: string
  storyId?: string
  featureId?: string
  openConfirm?: boolean
  onRequestClose: () => void
}

function StatusIcon({ status }: { status: GitMergeReportFile['status'] }) {
  const iconClass = 'w-4 h-4'
  if (status === 'A') return <IconFileAdded className={iconClass} />
  if (status === 'D') return <IconFileDeleted className={iconClass} />
  return <IconFileModified className={iconClass} />
}

function extractBadges(file: GitMergeReportFile): string[] {
  const badges: string[] = []
  const st = String(file.status || '')
  const patch = String(file.patch || '')
  if (st === 'R' || /\nrename (from|to) /i.test(patch)) badges.push('renamed')
  if (/\n(old mode|new mode)\s+\d{6}/i.test(patch)) badges.push('mode')
  if (/\b120000\b/.test(patch) || /symlink/i.test(patch)) badges.push('symlink')
  return badges
}

function FileDiffItem({ file, diffOpts }: { file: GitMergeReportFile; diffOpts: { wrap: boolean; ignoreWS: boolean; intra: IntraMode } }) {
  const [open, setOpen] = React.useState(false)
  const toggle = React.useCallback(() => setOpen((v) => !v), [])
  const title = open ? 'Hide changes' : 'View changes'
  const showStats = file.status === 'M' && (typeof file.additions === 'number' || typeof file.deletions === 'number')
  const badges = extractBadges(file)

  return (
    <div className='border rounded-md border-neutral-200 dark:border-neutral-800 overflow-hidden'>
      <div className='px-3 py-2 text-xs flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/40'>
        <div className='truncate font-mono pr-3 flex-1 flex items-center gap-2' title={file.path}>
          <StatusIcon status={file.status} />
          <span className='truncate'>{file.path}</span>
          {badges.length > 0 && (
            <span className='ml-2 inline-flex items-center gap-1'>
              {badges.map((b, i) => (
                <span key={i} className='px-1 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-800/60 text-[10px] uppercase tracking-wide text-neutral-700 dark:text-neutral-300'>
                  {b}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          <div className='text-[10px] tracking-wide text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5'>
            {showStats ? <span className='ml-1'>+{file.additions || 0}/-{file.deletions || 0}</span> : null}
          </div>
          <button
            type='button'
            onClick={toggle}
            title={title}
            aria-label={title}
            aria-expanded={open}
            className={`ml-2 inline-flex items-center justify-center rounded p-1 transition-colors border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 ${open ? 'bg-neutral-200/60 dark:bg-neutral-800/60' : 'bg-transparent'}`}
          >
            <IconChevron className={`w-4 h-4 text-neutral-600 dark:text-neutral-300 transform transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>
      {open && (
        <div className='max-h-64 overflow-auto text-xs font-mono'>
          {file.binary ? (
            <div className='p-3 text-neutral-600 dark:text-neutral-400'>Binary file diff not shown</div>
          ) : file.patch ? (
            <div className='p-1'>
              <StructuredUnifiedDiff patch={file.patch} wrap={diffOpts.wrap} ignoreWhitespace={diffOpts.ignoreWS} intraline={diffOpts.intra} />
            </div>
          ) : (
            <div className='p-3 text-neutral-600 dark:text-neutral-400'>No patch available</div>
          )}
        </div>
      )}
    </div>
  )
}

function ConflictsPanel({ conflicts, baseRef, branch }: { conflicts: GitConflictEntry[]; baseRef: string; branch: string }) {
  return (
    <div className='border rounded-md border-amber-300/50 dark:border-amber-600/40 overflow-hidden'>
      <div className='px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'>
        Merge conflicts detected
      </div>
      <div className='p-3 text-sm'>
        <div className='text-neutral-700 dark:text-neutral-300 mb-2'>
          The merge of <span className='font-mono'>{branch}</span> into <span className='font-mono'>{baseRef}</span> has conflicts. Resolve them in your editor, then commit the merge.
        </div>
        <ul className='list-disc pl-5 text-xs text-neutral-700 dark:text-neutral-300 space-y-1'>
          {conflicts.map((c) => (
            <li key={c.path}>
              <span className='font-mono'>{c.path}</span> — {c.type}
            </li>
          ))}
        </ul>
        <div className='mt-3 text-xs text-neutral-600 dark:text-neutral-400'>Tip: Use your preferred diff/merge tool to resolve, then return here or close this dialog.</div>
      </div>
    </div>
  )
}

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
      const m = line.match(/\+([0-9]+)(?:,([0-9]+))?\s*@@/)
      if (m) currentNewLine = parseInt(m[1], 10) - 1
      continue
    }
    if (line.startsWith('+++ ') || line.startsWith('--- ')) continue
    if (line.startsWith('+')) {
      currentNewLine += 1
      added.push(currentNewLine)
    } else if (line.startsWith('-')) {
      continue
    } else {
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
    <div className='h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden'>
      <div className={`h-full ${value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

export default function GitMergeModal(props: GitMergeModalProps) {
  const { onRequestClose, projectId, repoPath, baseRef, branch, storyId, featureId, openConfirm } = props
  const { getProjectById } = useProjectContext()
  const { mergePreferences, unified } = useGit()
  const { autoPush, deleteRemote, setAutoPush, setDeleteRemote } = mergePreferences

  const project = getProjectById(projectId)

  const [loading, setLoading] = React.useState(true)
  const [report, setReport] = React.useState<GitMergeReport | undefined>(undefined)
  const [error, setError] = React.useState<string | undefined>(undefined)

  const [merging, setMerging] = React.useState(false)
  const [mergeError, setMergeError] = React.useState<string | undefined>(undefined)
  const [mergeResult, setMergeResult] = React.useState<GitMergeResult | undefined>(undefined)

  const [postActionRunning, setPostActionRunning] = React.useState(false)
  const [postActionError, setPostActionError] = React.useState<string | undefined>(undefined)

  const [confirmOpen, setConfirmOpen] = React.useState<boolean>(!!openConfirm)

  const [activeTab, setActiveTab] = React.useState<'changes' | 'compilation' | 'tests' | 'coverage' | 'resolve'>('changes')

  const hasConflicts = (mergeResult?.conflicts?.length || 0) > 0

  const [compilationInfo, setCompilationInfo] = React.useState<{ summary: string; details: Array<{ path: string; risk: 'low' | 'medium' | 'high'; reason: string }> } | null>(null)

  const [testsImpact, setTestsImpact] = React.useState<{ impacted: string[]; totalCatalog: number } | null>(null)
  const [testsImpactError, setTestsImpactError] = React.useState<string | null>(null)

  const [coverageLoading, setCoverageLoading] = React.useState(false)
  const [coverageError, setCoverageError] = React.useState<string | null>(null)
  const [diffCoverage, setDiffCoverage] = React.useState<{ totalAdded: number; covered: number; pct: number; perFile: Array<{ path: string; added: number; covered: number; pct: number }> } | null>(null)

  // Diff options for Changes tab
  const [wrap, setWrap] = React.useState<boolean>(false)
  const [ignoreWS, setIgnoreWS] = React.useState<boolean>(false)
  const [intra, setIntra] = React.useState<IntraMode>('none')

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(undefined)
      try {
        const plan = await gitService.getMergePlan(projectId, { sources: [branch], baseRef, includePatch: true })
        const rep = await gitService.buildMergeReport(projectId, plan, { includePatch: true, includeStructuredDiff: true, analyses: ['compilation', 'tests', 'coverage'] })
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
  }, [projectId, repoPath, baseRef, branch])

  React.useEffect(() => {
    if (hasConflicts) setActiveTab('resolve')
  }, [hasConflicts])

  React.useEffect(() => {
    if (!report) {
      setCompilationInfo(null)
      return
    }
    const backend = report.analysis?.compilation
    if (backend) {
      setCompilationInfo(backend)
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
        const churn = (f.additions || 0) + (f.deletions || 0)
        const risk: 'low' | 'medium' | 'high' = churn > 200 ? 'high' : churn > 50 ? 'medium' : 'low'
        details.push({ path: p, risk, reason: `Source change (+${f.additions || 0}/-${f.deletions || 0})` })
        continue
      }
      if (p.endsWith('.json') || p.endsWith('.yaml') || p.endsWith('.yml')) {
        details.push({ path: p, risk: 'medium', reason: 'Configuration/content change' })
        continue
      }
      details.push({ path: p, risk: 'low', reason: 'Non-code change' })
    }

    const counts = details.reduce((acc, d) => {
      acc[d.risk] += 1
      return acc
    }, { low: 0, medium: 0, high: 0 } as Record<'low' | 'medium' | 'high', number>)
    const summary = `Risk estimate · High ${counts.high} · Medium ${counts.medium} · Low ${counts.low} (no compile adapter configured)`
    setCompilationInfo({ summary, details })
  }, [report])

  React.useEffect(() => {
    let cancelled = false
    async function run() {
      if (activeTab !== 'tests') return
      if (!projectId || !report) {
        setTestsImpact(null)
        return
      }
      const backend = report.analysis?.tests
      if (backend) {
        if (!cancelled) {
          setTestsImpactError(null)
          setTestsImpact(backend)
        }
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
    return () => { cancelled = true }
  }, [activeTab, projectId, report])

  React.useEffect(() => {
    let cancelled = false
    async function compute() {
      if (activeTab !== 'coverage') return
      if (!projectId || !report) {
        setDiffCoverage(null)
        return
      }
      const backend = report.analysis?.coverage
      if (backend) {
        if (!cancelled) {
          setCoverageError(null)
          setCoverageLoading(false)
          setDiffCoverage(backend)
        }
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
        const coverByRel: Record<string, { uncovered: Set<number>; pct_lines: number | null }> = {}
        for (const [file, stats] of Object.entries<any>(cov.files || {})) {
          const rel = normalizePath(file)
          const uncovered = new Set<number>(Array.isArray((stats as any).uncovered_lines) ? ((stats as any).uncovered_lines as number[]) : [])
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
            for (const ln of addedLines) if (!cover.uncovered.has(ln)) fileCovered += 1
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
    return () => { cancelled = true }
  }, [activeTab, projectId, report])

  const doMergeWithPostActions = async () => {
    if (merging || postActionRunning) return
    setMerging(true)
    setMergeError(undefined)
    setMergeResult(undefined)
    setPostActionError(undefined)
    try {
      const res = await gitService.applyMerge(projectId, { sources: [branch], baseRef, allowFastForward: true })
      setMergeResult(res)
      const hasConf = !!(res?.conflicts && res.conflicts.length > 0)
      if (res?.ok && !hasConf) {
        let localError: string | undefined
        if (autoPush || deleteRemote) {
          setPostActionRunning(true)
          let pushOk = true
          if (autoPush) {
            const pushRes = await gitService.push(projectId, 'origin', baseRef)
            if (!pushRes || !pushRes.ok) {
              pushOk = false
              localError = ((pushRes as any).error || 'Push failed') + (pushRes?.result?.stderr ? `\n${pushRes.result.stderr}` : '')
            }
          }
          if (deleteRemote && (!autoPush || pushOk)) {
            const shortBranch = branch.replace(/^[^\/]+\//, '')
            const delRes = await gitService.deleteRemoteBranch(projectId, shortBranch)
            if (!delRes || !delRes.ok) {
              localError = ((delRes as any)?.error || 'Delete remote branch failed') + (delRes?.result?.stderr ? `\n${delRes.result.stderr}` : '')
            }
          }
          setPostActionRunning(false)
        }
        try { await unified.reload(projectId) } catch {}
        try { await gitService.getLocalStatus(projectId) } catch {}
        try { window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } })) } catch {}
        if (localError) {
          setPostActionError(localError)
        } else {
          onRequestClose()
          return
        }
      }
    } catch (e: any) {
      console.error('Merge failed', e)
      setMergeError(e?.message || String(e))
    } finally {
      setMerging(false)
    }
  }

  const header = (
    <div className='flex flex-col gap-1.5'>
      <div className='text-base font-semibold'>Prepare merge</div>
      <div className='text-xs text-neutral-600 dark:text-neutral-400'>
        {project?.title || projectId} · base {baseRef} · source {branch}
        {storyId ? ` · story ${storyId}` : ''}
        {featureId ? ` · feature ${featureId}` : ''}
      </div>
    </div>
  )

  const footer = (
    <div className='flex items-center justify-between gap-2 w-full'>
      <div className='text-xs text-neutral-600 dark:text-neutral-400'>
        {report?.totals ? `+${report.totals.insertions}/-${report.totals.deletions} · ${report.totals.filesChanged} files` : 'Totals unavailable'}
      </div>
      <div className='flex items-center gap-2'>
        <Button onClick={onRequestClose} variant='secondary'>Close</Button>
        <Tooltip content={'fast merge'} placement='top'>
          <Button onClick={() => setConfirmOpen(true)} loading={merging || postActionRunning} disabled={merging || postActionRunning}>
            <span className='inline-flex items-center gap-2'>
              <IconFastMerge className='w-4 h-4' />
              {merging ? 'Merging…' : postActionRunning ? 'Finalizing…' : 'Merge'}
            </span>
          </Button>
        </Tooltip>
      </div>
    </div>
  )

  function renderChangesTab() {
    return (
      <div className='flex flex-col gap-3'>
        {loading && (
          <div className='p-3 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2'>
            <Spinner size={14} label='Loading diff preview...' />
          </div>
        )}
        {!loading && error && (
          <div className='p-3 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap'>{error}</div>
        )}
        <div className='px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 rounded-md flex items-center justify-end gap-3 bg-neutral-50/60 dark:bg-neutral-900/40'>
          <label className='inline-flex items-center gap-1'>
            <input type='checkbox' checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
            <span>Wrap</span>
          </label>
          <label className='inline-flex items-center gap-1'>
            <input type='checkbox' checked={ignoreWS} onChange={(e) => setIgnoreWS(e.target.checked)} />
            <span>Ignore WS</span>
          </label>
          <label className='inline-flex items-center gap-1'>
            <span>Intra</span>
            <select className='border border-neutral-200 dark:border-neutral-800 bg-transparent rounded px-1 py-0.5' value={intra} onChange={(e) => setIntra(e.target.value as IntraMode)}>
              <option value='none'>none</option>
              <option value='word'>word</option>
              <option value='char'>char</option>
            </select>
          </label>
        </div>
        {!loading && !error && (!report || report.files.length === 0) && (
          <div className='p-3 text-sm text-neutral-600 dark:text-neutral-400'>Diff preview unavailable. You can still proceed to merge.</div>
        )}
        {!loading && !error && report && report.files.length > 0 && (
          <div className='flex flex-col gap-3'>
            {report.files.map((f: GitMergeReportFile) => (
              <FileDiffItem key={f.path} file={f} diffOpts={{ wrap, ignoreWS, intra }} />
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderCompilationTab() {
    return (
      <div className='border rounded-md p-3 border-neutral-200 dark:border-neutral-800'>
        <div className='text-sm font-medium mb-2'>Compilation Impact</div>
        {!report && loading && (
          <div className='text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2'><Spinner size={14} label='Analyzing...' /></div>
        )}
        {report && compilationInfo && (
          <div className='space-y-3'>
            <div className='text-xs text-neutral-700 dark:text-neutral-300'>{compilationInfo.summary}</div>
            <div className='max-h-48 overflow-auto divide-y divide-neutral-100 dark:divide-neutral-900'>
              {compilationInfo.details.map((d, idx) => (
                <div key={idx} className='py-1.5 flex items-center justify-between gap-3'>
                  <div className='text-xs font-mono truncate'>{d.path}</div>
                  <div className='text-xs text-neutral-600 dark:text-neutral-400'>
                    <span className={d.risk === 'high' ? 'text-red-600 dark:text-red-400' : d.risk === 'medium' ? 'text-amber-700 dark:text-amber-300' : 'text-neutral-500'}>{d.risk.toUpperCase()}</span>
                    <span className='ml-2'>{d.reason}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className='text-[11px] text-neutral-500'>Heuristic only when no backend analysis is available.</div>
          </div>
        )}
        {!report && !loading && <div className='text-xs text-neutral-500'>Report unavailable.</div>}
      </div>
    )
  }

  function renderTestsTab() {
    return (
      <div className='border rounded-md p-3 border-neutral-200 dark:border-neutral-800'>
        <div className='text-sm font-medium mb-2'>Tests Impact</div>
        {!report && loading && (
          <div className='text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2'><Spinner size={14} label='Analyzing...' /></div>
        )}
        {testsImpactError && (
          <div className='text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap'>{testsImpactError}</div>
        )}
        {report && !testsImpactError && testsImpact && (
          <div className='space-y-2'>
            <div className='text-xs text-neutral-700 dark:text-neutral-300'>
              {testsImpact.impacted.length} potential test{testsImpact.impacted.length === 1 ? '' : 's'} may be affected out of {testsImpact.totalCatalog}.
            </div>
            {testsImpact.impacted.length === 0 ? (
              <div className='text-xs text-neutral-500'>No likely impacted tests detected.</div>
            ) : (
              <div className='max-h-48 overflow-auto'>
                <ul className='list-disc pl-5 text-xs text-neutral-700 dark:text-neutral-300 space-y-1'>
                  {testsImpact.impacted.map((t, i) => (
                    <li key={i} className='truncate' title={t}><span className='font-mono'>{t}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div className='text-[11px] text-neutral-500'>Heuristic mapping when backend analysis is unavailable. Open Tests view to run targeted tests.</div>
          </div>
        )}
      </div>
    )
  }

  function renderCoverageTab() {
    return (
      <div className='border rounded-md p-3 border-neutral-200 dark:border-neutral-800'>
        <div className='text-sm font-medium mb-2'>Diff Coverage</div>
        {coverageError && (<div className='text-xs text-amber-700 dark:text-amber-300 whitespace-pre-wrap'>{coverageError}</div>)}
        {coverageLoading && (<div className='text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2'><Spinner size={14} label='Computing diff coverage...' /></div>)}
        {!coverageLoading && !coverageError && diffCoverage && (
          <div className='space-y-3'>
            <div className='text-xs text-neutral-700 dark:text-neutral-300 flex items-center gap-3'>
              <div className={`text-sm font-medium ${pctColor(diffCoverage.pct)}`}>{diffCoverage.pct.toFixed(1)}% covered</div>
              <div className='text-xs text-neutral-600 dark:text-neutral-400'>{diffCoverage.covered}/{diffCoverage.totalAdded} changed lines covered</div>
            </div>
            <ProgressBar value={diffCoverage.pct} />
            <div className='max-h-48 overflow-auto'>
              <table className='w-full text-xs'>
                <thead className='text-neutral-600 dark:text-neutral-400'>
                  <tr>
                    <th className='text-left px-2 py-1'>File</th>
                    <th className='text-right px-2 py-1'>Changed</th>
                    <th className='text-right px-2 py-1'>Covered</th>
                    <th className='text-right px-2 py-1'>%</th>
                  </tr>
                </thead>
                <tbody>
                  {diffCoverage.perFile.length === 0 ? (
                    <tr><td className='px-2 py-2 text-neutral-500' colSpan={4}>No added lines detected in patch.</td></tr>
                  ) : (
                    diffCoverage.perFile.map((r, idx) => (
                      <tr key={idx} className='border-t border-neutral-100 dark:border-neutral-900'>
                        <td className='px-2 py-1 font-mono truncate' title={r.path}>{r.path}</td>
                        <td className='px-2 py-1 text-right'>{r.added}</td>
                        <td className='px-2 py-1 text-right'>{r.covered}</td>
                        <td className={`px-2 py-1 text-right ${pctColor(r.pct)}`}>{r.pct.toFixed(1)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className='text-[11px] text-neutral-500'>Uses backend analysis when available; otherwise based on last coverage run in Tests view.</div>
          </div>
        )}
      </div>
    )
  }

  function renderActiveTab() {
    switch (activeTab) {
      case 'changes':
        return renderChangesTab()
      case 'compilation':
        return renderCompilationTab()
      case 'tests':
        return renderTestsTab()
      case 'coverage':
        return renderCoverageTab()
      case 'resolve':
        return (
          <div className='space-y-3'>
            <div className='text-sm text-neutral-700 dark:text-neutral-300'>Resolve merge conflicts directly in the app. Save each file after resolving hunks.</div>
            {hasConflicts && mergeResult?.conflicts ? (
              <MergeConflictResolver projectId={projectId} baseRef={baseRef} branch={branch} conflicts={mergeResult.conflicts} />
            ) : (
              <div className='text-sm text-neutral-600 dark:text-neutral-400'>No conflicts to resolve.</div>
            )}
            <div className='text-[11px] text-neutral-500'>Tip: use 'Save & Stage' per file and the bottom bar to finalize the merge with a commit message and optional push.</div>
          </div>
        )
      default:
        return null
    }
  }

  const confirmSummary = (
    <div className='space-y-3'>
      <div className='text-sm text-neutral-700 dark:text-neutral-300'>You are about to merge <span className='font-mono'>{branch}</span> into <span className='font-mono'>{baseRef}</span>.</div>
      <div className='text-xs text-neutral-600 dark:text-neutral-400'>
        {report?.totals ? `Summary: +${report.totals.insertions}/-${report.totals.deletions} across ${report.totals.filesChanged} files` : 'Diff totals unavailable.'}
      </div>
      <div className='border-t pt-3 mt-1 border-neutral-200 dark:border-neutral-800'>
        <label className='flex items-start gap-2 text-sm cursor-pointer select-none'>
          <input type='checkbox' className='mt-0.5' checked={autoPush} onChange={(e) => setAutoPush(e.target.checked)} />
          <span>
            Automatically push to origin
            <div className='text-xs text-neutral-500'>Saves setting. Pushes {baseRef} after merge.</div>
          </span>
        </label>
        <label className='flex items-start gap-2 text-sm cursor-pointer select-none mt-2'>
          <input type='checkbox' className='mt-0.5' checked={deleteRemote} onChange={(e) => setDeleteRemote(e.target.checked)} />
          <span>
            Delete remote branch after merge
            <div className='text-xs text-neutral-500'>Saves setting. Removes origin/{branch}.</div>
          </span>
        </label>
      </div>
    </div>
  )

  return (
    <>
      <Modal isOpen={true} onClose={onRequestClose} title={header} size='xl' footer={footer}>
        <div className='sticky top-0 z-10 -mx-4 px-4 py-2 bg-surface-overlay/95 backdrop-blur border-b border-border'>
          <SegmentedControl ariaLabel='Merge tabs' value={activeTab} onChange={(v) => setActiveTab(v as any)} options={[
            { value: 'changes', label: 'Changes' },
            ...(hasConflicts ? ([{ value: 'resolve', label: 'Resolve conflicts' }] as any) : ([] as any)),
            { value: 'compilation', label: 'Compilation Impact' },
            { value: 'tests', label: 'Tests Impact' },
            { value: 'coverage', label: 'Diff Coverage' },
          ]} />
        </div>

        <div className='flex flex-col gap-4'>
          {mergeError && (<div className='p-3 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap border border-red-200 dark:border-red-800 rounded-md'>{mergeError}</div>)}
          {mergeResult && !mergeError && !hasConflicts && !mergeResult.ok && (<div className='p-3 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap border border-red-200 dark:border-red-800 rounded-md'>{mergeResult.message || 'Merge failed'}</div>)}
          {hasConflicts && activeTab !== 'resolve' && (<ConflictsPanel conflicts={mergeResult!.conflicts || []} baseRef={baseRef} branch={branch} />)}
          {postActionError && (<div className='p-3 text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap border border-red-200 dark:border-red-800 rounded-md'>{postActionError}</div>)}
          {renderActiveTab()}
        </div>
      </Modal>

      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title={<div className='text-base font-semibold'>Confirm merge</div>} size='md' footer={
        <div className='flex items-center justify-end gap-2 w-full'>
          <Button onClick={() => setConfirmOpen(false)} variant='secondary'>Cancel</Button>
          <Button onClick={() => { setConfirmOpen(false); void doMergeWithPostActions() }} loading={merging || postActionRunning} disabled={merging || postActionRunning}>
            {merging || postActionRunning ? 'Working…' : 'Confirm & Merge'}
          </Button>
        </div>
      }>
        {confirmSummary}
      </Modal>
    </>
  )
}
