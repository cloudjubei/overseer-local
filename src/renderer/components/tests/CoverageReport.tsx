import React from 'react'
import type { ParsedCoverage } from '../../utils/coverage'
import { formatUncoveredLines } from '../../utils/coverage'
import { useNavigator } from '../../navigation/Navigator'
import { useStories } from '../../contexts/StoriesContext'
import { useActiveProject } from '../../contexts/ProjectContext'
import { Button } from '../ui/Button'

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
    <div className="h-2 w-24 bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden">
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

export default function CoverageReport({ data }: { data: ParsedCoverage }) {
  const { openModal } = useNavigator()
  const { storyIdsByProject, storiesById, createStory } = useStories()
  const { projectId } = useActiveProject()

  const rows = React.useMemo(() => {
    const list: {
      file: string
      pct_lines: number
      pct_statements: number
      pct_branch: number | null
      pct_functions: number | null
      uncovered_lines: number[]
    }[] = []
    for (const [file, v] of Object.entries<any>(data?.files || {})) {
      list.push({
        file,
        pct_lines: typeof (v as any).pct_lines === 'number' ? (v as any).pct_lines : 0,
        pct_statements:
          typeof (v as any).pct_statements === 'number' ? (v as any).pct_statements : 0,
        pct_branch: typeof (v as any).pct_branch === 'number' ? (v as any).pct_branch : null,
        pct_functions:
          typeof (v as any).pct_functions === 'number' ? (v as any).pct_functions : null,
        uncovered_lines: Array.isArray((v as any).uncovered_lines)
          ? (v as any).uncovered_lines
          : [],
      })
    }
    // Sort by lines coverage ascending (worst first)
    list.sort((a, b) => a.pct_lines - b.pct_lines)
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
          <div className="flex items-center gap-2">
            <span className="text-neutral-600 dark:text-neutral-400">Lines</span>
            <span className={`text-sm font-medium ${pctColor(summary.avgLinesPct)}`}>
              {summary.avgLinesPct.toFixed(1)}%
            </span>
            <ProgressBar value={summary.avgLinesPct} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-600 dark:text-neutral-400">Statements</span>
            <span className={`text-sm font-medium ${pctColor(summary.avgStatementsPct)}`}>
              {summary.avgStatementsPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-600 dark:text-neutral-400">Branches</span>
            <span className={`text-sm font-medium ${pctColor(summary.avgBranchesPct)}`}>
              {summary.avgBranchesPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-600 dark:text-neutral-400">Functions</span>
            <span className={`text-sm font-medium ${pctColor(summary.avgFunctionsPct)}`}>
              {summary.avgFunctionsPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
            <tr>
              <th className="text-left px-3 py-2">File</th>
              <th className="text-right px-3 py-2">Statements</th>
              <th className="text-right px-3 py-2">Branches</th>
              <th className="text-right px-3 py-2">Functions</th>
              <th className="text-right px-3 py-2">Lines</th>
              <th className="text-left px-3 py-2">Uncovered lines</th>
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
                const rel = normalizePath(f.file)
                const uncoveredText = formatUncoveredLines(f.uncovered_lines)
                const showImprove = (f.pct_lines ?? 0) < 80 || (f.uncovered_lines?.length ?? 0) > 0
                return (
                  <tr key={i} className="border-t border-neutral-200 dark:border-neutral-800 group">
                    <td className="px-3 py-2">
                      <div className="truncate max-w-[520px]" title={f.file}>
                        {rel}
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${pctColor(f.pct_statements)}`}>
                      {f.pct_statements.toFixed(1)}%
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${pctColor(f.pct_branch ?? 0)}`}>
                      {typeof f.pct_branch === 'number' ? f.pct_branch.toFixed(1) : '—'}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${pctColor(f.pct_functions ?? 0)}`}>
                      {typeof f.pct_functions === 'number' ? f.pct_functions.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <span className={`tabular-nums ${pctColor(f.pct_lines)}`}>{f.pct_lines.toFixed(1)}%</span>
                        <ProgressBar value={f.pct_lines} />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div
                        className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate max-w-[360px]"
                        title={uncoveredText}
                      >
                        {uncoveredText}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {showImprove ? (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex justify-end">
                          <Button
                            size="xs"
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
