import React from 'react'
import { formatUncoveredLines } from '../../utils/coverage'
import { useNavigator } from '../../navigation/Navigator'
import { useStories } from '../../contexts/StoriesContext'
import { useActiveProject } from '../../contexts/ProjectContext'
import { Button } from '../ui/Button'
import { CoverageResult } from 'thefactory-tools'

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
}

function buildBreakdownTitle({ label, pct, covered, total }: MetricCellProps): string {
  const pctText = typeof pct === 'number' ? `${pct.toFixed(1)}%` : '—'
  const hasCounts = typeof covered === 'number' && typeof total === 'number'
  if (hasCounts) {
    return `${label}: ${pctText} (${covered}/${total})`
  }
  return `${label}: ${pctText}`
}

function MetricCell({ label, pct, covered = null, total = null }: MetricCellProps) {
  const pctVal = typeof pct === 'number' ? pct : null
  return (
    <div className="w-28 mx-auto text-center" title={buildBreakdownTitle({ label, pct, covered, total })}>
      <div className={`text-sm font-medium tabular-nums ${pctVal !== null ? pctColor(pctVal) : 'text-neutral-400'}`}>
        {pctVal !== null ? `${pctVal.toFixed(1)}%` : '—'}
      </div>
      <div className="mt-1">
        {pctVal !== null ? <ProgressBar value={pctVal} /> : <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded" />}
      </div>
    </div>
  )
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
    for (const [file, v] of Object.entries<any>(data?.files || {})) {
      const rel = normalizePath(file)
      const pct_lines = typeof (v as any).pct_lines === 'number' ? (v as any).pct_lines : 0
      const pct_statements =
        typeof (v as any).pct_statements === 'number' ? (v as any).pct_statements : 0
      const pct_branch = typeof (v as any).pct_branch === 'number' ? (v as any).pct_branch : null
      const pct_functions =
        typeof (v as any).pct_functions === 'number' ? (v as any).pct_functions : null
      const uncovered_lines: number[] = Array.isArray((v as any).uncovered_lines)
        ? (v as any).uncovered_lines
        : []

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
      if (lines_total !== null && lines_covered === null && Array.isArray(uncovered_lines)) {
        lines_covered = Math.max(0, lines_total - uncovered_lines.length)
      }

      list.push({
        file,
        rel,
        pct_lines,
        pct_statements,
        pct_branch,
        pct_functions,
        statements_total,
        statements_covered,
        branches_total,
        branches_covered,
        functions_total,
        functions_covered,
        lines_total,
        lines_covered,
        uncovered_lines,
      })
    }
    // Sort alphabetically by path
    list.sort((a, b) => a.rel.localeCompare(b.rel))
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
      } as any)
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
      `Improve test coverage for @${rel}.`,
      lines && lines !== '—' ? `Target uncovered lines: ${lines}.` : undefined,
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
    <div className="space-y-3">
      <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="text-neutral-800 dark:text-neutral-200 font-medium">Summary</div>
          <div className="text-neutral-600 dark:text-neutral-400">{summary.fileCount} files</div>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <MetricCell label="Statements" pct={summary.avgStatementsPct} />
            <MetricCell label="Branches" pct={summary.avgBranchesPct} />
            <MetricCell label="Functions" pct={summary.avgFunctionsPct} />
            <MetricCell label="Lines" pct={summary.avgLinesPct} />
          </div>
        </div>
      </div>

      <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            <col className="w-auto" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-40" />
            <col className="w-32" />
          </colgroup>
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
            <tr>
              <th className="text-left px-3 py-2">File</th>
              <th className="text-center px-3 py-2">Statements</th>
              <th className="text-center px-3 py-2">Branches</th>
              <th className="text-center px-3 py-2">Functions</th>
              <th className="text-center px-3 py-2">Lines</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Uncovered lines</th>
              <th className="text-right px-3 py-2">Actions</th>
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
                      <div className="truncate max-w-[520px]" title={f.file}>
                        {f.rel}
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
                    <td className="px-3 py-2">
                      <div
                        className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate w-40"
                        title={uncoveredText}
                      >
                        {uncoveredText}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {showImprove ? (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onImproveTestsClick(f.file, f.uncovered_lines || [])}
                          >
                            Improve tests
                          </Button>
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {data && (data as any).rawText && (
        <details className="mt-2">
          <summary className="text-xs text-neutral-500 cursor-pointer">View raw output</summary>
          <pre className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap break-all max-h-64 overflow-auto bg-neutral-50 dark:bg-neutral-900 p-2 rounded">
            {(data as any).rawText}
          </pre>
        </details>
      )}
    </div>
  )
}
