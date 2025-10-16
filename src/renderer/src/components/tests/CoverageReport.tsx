import React from 'react'
import { useNavigator } from '../../navigation/Navigator'
import { useStories } from '../../contexts/StoriesContext'
import { useActiveProject } from '../../contexts/ProjectContext'
import { Button } from '../ui/Button'
import { CoverageFileStats, CoverageResult } from 'thefactory-tools'
import { IconDoubleUp } from '../ui/icons/Icons'

function pctColor(p: number) {
  if (p >= 90) return 'text-green-700 dark:text-green-300'
  if (p >= 75) return 'text-amber-700 dark:text-amber-300'
  if (p >= 50) return 'text-orange-700 dark:text-orange-300'
  return 'text-red-700 dark:text-red-300'
}

function barColor(p: number) {
  if (p >= 90) return 'bg-green-500'
  if (p >= 75) return 'bg-amber-500'
  if (p >= 50) return 'bg-orange-500'
  return 'bg-red-500'
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden">
      <div className={`h-full ${barColor(clamped)}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

function getFilename(p: string): string {
  let parts = p.split('/')
  return parts[parts.length - 1]
}
function getDirname(p: string): string {
  let parts = p.split('/')
  parts.pop()
  return parts.join('/')
}
function normalizePath(p: string): string {
  let out = p.replace(/\\/g, '/').replace(/^\.[/\\]/, '')
  // Attempt to trim anything before common roots, prefer starting at src/
  const m = out.match(/(?:^|.*?)(src\/.*)$/)
  if (m && m[1]) return m[1]
  return out.replace(/^\//, '')
}

function findTotal(obj: any, base: string): number | null {
  const keys = [
    `${base}_total`,
    `total_${base}`,
    `${base}Total`,
    `total${base[0].toUpperCase()}${base.slice(1)}`,
  ]
  for (const k of keys) {
    if (typeof obj?.[k] === 'number') return obj[k]
  }
  return null
}
function findCovered(obj: any, base: string): number | null {
  const keys = [
    `${base}_covered`,
    `covered_${base}`,
    `${base}Covered`,
    `covered${base[0].toUpperCase()}${base.slice(1)}`,
  ]
  for (const k of keys) {
    if (typeof obj?.[k] === 'number') return obj[k]
  }
  return null
}

type MetricCellProps = {
  label: string
  pct: number | null
  covered?: number | null
  total?: number | null
  showLabel?: boolean
}

function MetricCell({ label, pct }: MetricCellProps) {
  const pctVal = typeof pct === 'number' ? pct : null
  if (pctVal === null) {
    // Show nothing if there is no value to display (no placeholder dash)
    return <div className="mx-auto text-center" title={label}></div>
  }
  return (
    <div className="mx-auto text-center" title={label}>
      <div className={`text-sm font-medium tabular-nums ${pctColor(pctVal)}`}>
        {`${pctVal.toFixed(1)}%`}
      </div>
      <div className="mt-1">
        <ProgressBar value={pctVal} />
      </div>
    </div>
  )
}

function comparePathsDepthFirst(aRel: string, bRel: string): number {
  const aSeg = aRel.split('/')
  const bSeg = bRel.split('/')

  const len = Math.min(aSeg.length - 1, bSeg.length - 1) //compare dirs
  for (let i = 0; i < len; i++) {
    const cmp = aSeg[i].localeCompare(bSeg[i])
    if (cmp !== 0) return cmp
  }
  return aSeg.length - bSeg.length
}

export default function CoverageReport({ data }: { data: CoverageResult }) {
  const { openModal } = useNavigator()
  const { storyIdsByProject, storiesById, createStory } = useStories()
  const { projectId } = useActiveProject()

  const rows = React.useMemo(() => {
    const list: {
      file: string
      rel: string
      pct_lines: number
      pct_statements: number
      pct_branch: number | null
      pct_functions: number | null
      statements_total: number | null
      statements_covered: number | null
      branches_total: number | null
      branches_covered: number | null
      functions_total: number | null
      functions_covered: number | null
      lines_total: number | null
      lines_covered: number | null
      uncovered_lines: number[]
    }[] = []
    for (const [file, v] of Object.entries<CoverageFileStats>(data?.files || {})) {
      const rel = normalizePath(file)

      // Try to find totals/covered counts if provided by the backend
      const statements_total = findTotal(v, 'statements')
      const statements_covered = findCovered(v, 'statements')
      const branches_total = findTotal(v, 'branches')
      const branches_covered = findCovered(v, 'branches')
      const functions_total = findTotal(v, 'functions')
      const functions_covered = findCovered(v, 'functions')
      let lines_total = findTotal(v, 'lines')
      let lines_covered = findCovered(v, 'lines')

      // If lines covered not provided but total is, approximate from uncovered_lines
      if (lines_total !== null && lines_covered === null && Array.isArray(v.uncovered_lines)) {
        lines_covered = Math.max(0, lines_total - v.uncovered_lines.length)
      }

      list.push({
        ...v,
        file,
        rel,
        statements_total,
        statements_covered,
        branches_total,
        branches_covered,
        functions_total,
        functions_covered,
        lines_total,
        lines_covered,
      })
    }
    // Sort depth-first by path segments, alphabetically
    list.sort((a, b) => comparePathsDepthFirst(a.rel, b.rel))
    return list
  }, [data])

  const summary = React.useMemo(() => {
    const count = rows.length
    const avg = (getter: (r: (typeof rows)[number]) => number | null) => {
      const vals = rows.map(getter).filter((n): n is number => typeof n === 'number')
      if (!vals.length) return 0
      return vals.reduce((a, b) => a + b, 0) / vals.length
    }
    return {
      fileCount: count,
      avgLinesPct: avg((r) => r.pct_lines),
      avgStatementsPct: avg((r) => r.pct_statements),
      avgBranchesPct: avg((r) => r.pct_branch ?? 0),
      avgFunctionsPct: avg((r) => r.pct_functions ?? 0),
    }
  }, [rows])

  async function ensureTestingStory(): Promise<string | undefined> {
    if (!projectId) return undefined
    const ids = storyIdsByProject[projectId] || []
    const existing = ids
      .map((id) => storiesById[id])
      .find((s) => s && typeof s.title === 'string' && s.title.trim().toUpperCase() === 'TESTING')
    if (existing) return existing.id
    try {
      const created = await createStory({
        title: 'TESTING',
        description: 'Ongoing Testing improvements',
        status: '-',
      })
      return created?.id
    } catch (e) {
      console.error('Failed to create TESTING story', e)
      return undefined
    }
  }

  async function onImproveTestsClick(file: string, uncovered: number[]) {
    const storyId = await ensureTestingStory()
    if (!storyId) return
    const rel = normalizePath(file)
    const lines = formatUncoveredLines(uncovered)
    const title = `Add tests for ${rel}`
    const parts = [
      `Improve test coverage for @${rel} .`,
      lines && lines !== '—' ? `Target uncovered lines: ${lines} .` : undefined,
      '',
    ].filter(Boolean)
    const description = parts.join('\n')

    openModal({
      type: 'feature-create',
      storyId,
      initialValues: {
        title,
        description,
        status: '-',
        context: [rel],
      },
      focusDescription: true,
    })
  }

  return (
    <div className="h-full min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800">
      {/* Single scroll container handles both axes so header and rows scroll together */}
      <div className="h-full w-full overflow-auto">
        <table className="w-max text-sm table-fixed">
          <colgroup>
            <col className="max-w-[300px]" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="max-w-[200px]" />
            <col className="min-w-24" />
          </colgroup>
          <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
            <tr>
              <th className="text-left px-3 py-2">File</th>
              <th className="text-center px-3 py-2">Statements</th>
              <th className="text-center px-3 py-2">Branches</th>
              <th className="text-center px-3 py-2">Functions</th>
              <th className="text-center px-3 py-2">Lines</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Uncovered lines</th>
              <th className="text-center px-3 py-2">Actions</th>
            </tr>
            <tr>
              <th className="text-left px-3 pt-2 pb-3 font-normal text-neutral-600 dark:text-neutral-400">
                {summary.fileCount} files
              </th>
              <th className="text-center px-3 pt-2 pb-3 font-normal">
                <MetricCell label="Statements" pct={summary.avgStatementsPct} />
              </th>
              <th className="text-center px-3 pt-2 pb-3 font-normal">
                <MetricCell label="Branches" pct={summary.avgBranchesPct} />
              </th>
              <th className="text-center px-3 pt-2 pb-3 font-normal">
                <MetricCell label="Functions" pct={summary.avgFunctionsPct} />
              </th>
              <th className="text-center px-3 pt-2 pb-3 font-normal">
                <MetricCell label="Lines" pct={summary.avgLinesPct} />
              </th>
              <th className="text-left px-3 pt-2 pb-3 font-normal text-neutral-400"></th>
              <th className="text-right px-3 pt-2 pb-3 font-normal text-neutral-400"></th>
            </tr>
            <tr>
              <th className="h-0.5 bg-neutral-700/50"></th>
              <th className="h-0.5 bg-neutral-700/50"></th>
              <th className="h-0.5 bg-neutral-700/50"></th>
              <th className="h-0.5 bg-neutral-700/50"></th>
              <th className="h-0.5 bg-neutral-700/50"></th>
              <th className="h-0.5 bg-neutral-700/50"></th>
              <th className="h-0.5 bg-neutral-700/50"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-sm text-neutral-500" colSpan={7}>
                  No coverage data found.
                </td>
              </tr>
            ) : (
              rows.map((f, i) => {
                const uncoveredText = formatUncoveredLines(f.uncovered_lines)
                const showImprove = (f.pct_lines ?? 0) < 80 || (f.uncovered_lines?.length ?? 0) > 0
                return (
                  <tr key={i} className="border-t border-neutral-200 dark:border-neutral-800 group">
                    <td className="px-3 py-2">
                      <div className="truncate whitespace-nowrap" title={f.file}>
                        <div className="flex flex-col">
                          <span>{getFilename(f.file)}</span>
                          <span className="text-xs text-neutral-500 font-light">
                            {getDirname(f.file)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <MetricCell
                        label="Statements"
                        pct={f.pct_statements}
                        covered={f.statements_covered}
                        total={f.statements_total}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <MetricCell
                        label="Branches"
                        pct={f.pct_branch}
                        covered={f.branches_covered}
                        total={f.branches_total}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <MetricCell
                        label="Functions"
                        pct={f.pct_functions}
                        covered={f.functions_covered}
                        total={f.functions_total}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <MetricCell
                        label="Lines"
                        pct={f.pct_lines}
                        covered={f.lines_covered}
                        total={f.lines_total}
                      />
                    </td>
                    <td className="max-w-[200px] px-3 py-2">
                      {uncoveredText && uncoveredText !== '—' ? (
                        <div
                          className="text-xs text-neutral-600 dark:text-neutral-400 truncate"
                          title={uncoveredText}
                        >
                          {uncoveredText}
                        </div>
                      ) : null}
                    </td>
                    <td className="min-w-24 px-3 py-2 text-center">
                      {showImprove ? (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex justify-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onImproveTestsClick(f.file, f.uncovered_lines || [])}
                          >
                            <div className="flex flex-col items-center leading-none">
                              <IconDoubleUp className="w-4 h-4 mb-0.5" />
                              <span className="text-[10px]">Tests</span>
                            </div>
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function formatUncoveredLines(
  lines: number[] | undefined | null,
  options?: { maxSegments?: number },
): string {
  if (!Array.isArray(lines) || lines.length === 0) return '—'

  // Normalize: keep positive integers only, sort, and dedupe
  const sorted = Array.from(
    new Set(
      lines
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.trunc(n))
        .filter((n) => n > 0),
    ),
  ).sort((a, b) => a - b)

  if (sorted.length === 0) return '—'

  type Seg = { start: number; end: number }
  const segments: Seg[] = []

  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i]
    if (n === prev + 1) {
      // still consecutive, extend the current range
      prev = n
      continue
    }
    // end current segment and start a new one
    segments.push({ start, end: prev })
    start = n
    prev = n
  }
  // push the last segment
  segments.push({ start, end: prev })

  const maxSegments = options?.maxSegments
  const limited =
    typeof maxSegments === 'number' && maxSegments > 0 ? segments.slice(0, maxSegments) : segments

  const parts = limited.map((s) => (s.start === s.end ? String(s.start) : `${s.start}-${s.end}`))

  const hasMore = segments.length > (limited === segments ? segments.length : limited.length)
  return hasMore ? `${parts.join(', ')}…` : parts.join(', ')
}
