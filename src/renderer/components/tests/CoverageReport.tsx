import React from 'react'
import { ParsedCoverage, CoverageFile } from '../../utils/coverage'
import { extractRelPath } from '../../utils/testResults'

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

function FileRow({ f }: { f: CoverageFile }) {
  const rel = extractRelPath(f.filePath) || f.filePath
  const uncovered = f.uncoveredRanges
    ?.map((r) => (r.end != null ? `${r.start}-${r.end}` : `${r.start}`))
    .join(', ')
  return (
    <div className="grid grid-cols-[minmax(200px,1fr)_auto_auto_auto_auto_minmax(120px,1fr)] gap-3 items-center px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 text-xs">
      <div className="truncate" title={f.filePath}>
        {rel}
      </div>
      <div className={`justify-self-end tabular-nums ${pctColor(f.statementsPct)}`}>{f.statementsPct.toFixed(1)}%</div>
      <div className={`justify-self-end tabular-nums ${pctColor(f.branchesPct)}`}>{f.branchesPct.toFixed(1)}%</div>
      <div className={`justify-self-end tabular-nums ${pctColor(f.functionsPct)}`}>{f.functionsPct.toFixed(1)}%</div>
      <div className="justify-self-end flex items-center gap-2">
        <span className={`tabular-nums ${pctColor(f.linesPct)}`}>{f.linesPct.toFixed(1)}%</span>
        <ProgressBar value={f.linesPct} />
      </div>
      <div className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate" title={uncovered}>
        {uncovered || '—'}
      </div>
    </div>
  )
}

export default function CoverageReport({ data }: { data: ParsedCoverage }) {
  const { summary, files } = data

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
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

      <div className="rounded-md border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="grid grid-cols-[minmax(200px,1fr)_auto_auto_auto_auto_minmax(120px,1fr)] gap-3 items-center px-3 py-2 bg-neutral-50 dark:bg-neutral-900 text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
          <div>File</div>
          <div className="justify-self-end">Statements</div>
          <div className="justify-self-end">Branches</div>
          <div className="justify-self-end">Functions</div>
          <div className="justify-self-end">Lines</div>
          <div>Uncovered lines</div>
        </div>
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {files.length === 0 ? (
            <div className="px-3 py-4 text-sm text-neutral-500">No coverage data found.</div>
          ) : (
            files.map((f, i) => <FileRow key={i} f={f} />)
          )}
        </div>
      </div>
    </div>
  )
}
