import React from 'react'
import { filesService } from '../../services/filesService'
import { useActiveProject } from '../../contexts/ProjectContext'
import Spinner from '../ui/Spinner'
import { TestFailure, TestResult, TestsResult } from 'thefactory-tools'

function CodeSnippet({
  relPath,
  line,
  column,
}: {
  relPath: string
  line?: number | null
  column?: number | null
}) {
  const { projectId } = useActiveProject()
  const [state, setState] = React.useState<{ loading: boolean; text?: string; error?: string }>({
    loading: true,
  })

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const content = await filesService.readFile(projectId, relPath, 'utf8')
        if (cancelled) return
        if (typeof content !== 'string') {
          setState({ loading: false, error: 'No content available' })
          return
        }
        // Extract snippet around the failing line
        const lines = content.split(/\r?\n/)
        const idx = line && line > 0 ? line - 1 : 0
        const start = Math.max(0, idx - 4)
        const end = Math.min(lines.length, idx + 3)
        const numbered = [] as string[]
        for (let i = start; i < end; i++) {
          const ln = i + 1
          const marker = ln === line ? '>' : ' '
          const colMarker = ln === line && column ? `:${column}` : ''
          numbered.push(`${marker} ${ln.toString().padStart(4, ' ')}${colMarker}  ${lines[i]}`)
        }
        setState({ loading: false, text: numbered.join('\n') })
      } catch (e: any) {
        if (!cancelled) setState({ loading: false, error: e?.message || String(e) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, relPath, line, column])

  if (state.loading) return <Spinner size={14} label="Loading snippet..." />
  if (state.error)
    return <div className="text-xs text-neutral-500">Failed to load snippet: {state.error}</div>
  return (
    <pre className="text-xs bg-neutral-50 dark:bg-neutral-900 p-3 rounded-md overflow-auto whitespace-pre">
      {state.text}
    </pre>
  )
}

function FailureItem({ test, failure }: { test: TestResult; failure: TestFailure }) {
  const rel = test.filePath
  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          {failure.testName && (
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {failure.testName}
            </div>
          )}
          <div className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
            {failure.message}
          </div>
        </div>
      </div>
      <div className="text-xs text-neutral-600 dark:text-neutral-400">
        {rel}
        {failure.line ? `:${failure.line}` : ''}
        {failure.column ? `:${failure.column}` : ''}
      </div>
      <CodeSnippet
        relPath={rel}
        line={failure.line ?? undefined}
        column={failure.column ?? undefined}
      />
      {failure.stack && (
        <details className="mt-1">
          <summary className="text-xs text-neutral-500 cursor-pointer">Stack trace</summary>
          <pre className="text-[11px] bg-neutral-50 dark:bg-neutral-900 p-2 rounded-md overflow-auto whitespace-pre-wrap">
            {failure.stack}
          </pre>
        </details>
      )}
      {failure.message && (
        <details className="mt-1">
          <summary className="text-xs text-neutral-500 cursor-pointer">Message</summary>
          <pre className="text-[11px] bg-neutral-50 dark:bg-neutral-900 p-2 rounded-md overflow-auto whitespace-pre-wrap">
            {failure.message}
          </pre>
        </details>
      )}
    </div>
  )
}

function msToShort(ms?: number | null): string | null {
  if (!ms && ms !== 0) return null
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)} s`
  const m = Math.floor(s / 60)
  const rs = Math.round(s % 60)
  return `${m}m ${rs}s`
}

function FileHeader({ t }: { t: TestResult }) {
  const dur = msToShort(t.summary?.durationMs)
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="font-mono text-xs text-neutral-700 dark:text-neutral-300 break-all">
        {t.filePath}
      </div>
      <div className="text-xs flex items-center gap-2">
        <span className="text-green-600 dark:text-green-400">✓ {t.summary.passed}</span>
        <span className="text-red-600 dark:text-red-400">✗ {t.summary.failed}</span>
        <span className="text-amber-600 dark:text-amber-400">○ {t.summary.skipped}</span>
        {typeof t.summary.durationMs === 'number' && (
          <span className="text-neutral-500">• {dur}</span>
        )}
      </div>
    </div>
  )
}

function SkipsList({ t }: { t: TestResult }) {
  if (!t.skips?.length) return null
  return (
    <div className="space-y-1">
      {t.skips.map((s, i) => (
        <div key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <span>○</span>
          <span className="whitespace-pre-wrap break-words">{s.testName}</span>
        </div>
      ))}
    </div>
  )
}

function extractPassedNames(raw?: string): string[] {
  if (!raw) return []
  const out: string[] = []
  const lines = raw.split(/\r?\n/)
  for (const ln of lines) {
    const m = ln.match(/^\s*(?:✓|✔|√)\s+(.+)$/)
    if (m) {
      const name = (m[1] || '').trim()
      // Ignore potential summary lines that could be misinterpreted
      if (!/\btests?\b/i.test(name) && !/\bpassed\b/i.test(name) && !/\bskipped\b/i.test(name) && !/\bfailed\b/i.test(name)) {
        out.push(name)
      }
    }
  }
  return out
}

function PassesList({ t }: { t: TestResult }) {
  const names = React.useMemo(() => extractPassedNames(t.rawText), [t.rawText])
  if (!names.length) return null
  return (
    <div className="space-y-1">
      {names.map((n, i) => (
        <div key={i} className="text-xs text-green-700 dark:text-green-300 flex items-start gap-2">
          <span>✓</span>
          <span className="whitespace-pre-wrap break-words">{n}</span>
        </div>
      ))}
    </div>
  )
}

function RawOutput({ t }: { t: TestResult }) {
  if (!t.rawText) return null
  return (
    <details>
      <summary className="text-xs text-neutral-500 cursor-pointer">Raw output</summary>
      <pre className="text-[11px] bg-neutral-50 dark:bg-neutral-900 p-2 rounded-md overflow-auto whitespace-pre-wrap max-h-64">
        {t.rawText}
      </pre>
    </details>
  )
}

export default function TestResultsView({ results }: { results: TestsResult }) {
  const tests = Array.isArray(results.tests) ? results.tests : []

  const failing = tests.filter((t) => (t.failures?.length || 0) > 0 || t.status === 'fail')
  const skippedFiles = tests.filter((t) => (t.summary?.skipped || 0) > 0)
  const passing = tests.filter((t) => t.summary?.passed > 0 && t.status === 'ok')

  const hasFailures = (results.summary?.failed || 0) > 0 || failing.length > 0
  const hasSkips = (results.summary?.skipped || 0) > 0
  const hasPasses = (results.summary?.passed || 0) > 0

  const totalDur = msToShort(results.summary?.durationMs)

  return (
    <div className="space-y-4">
      {/* Overall summary bar */}
      <div
        className={
          'rounded-md p-3 text-sm ' +
          (hasFailures
            ? 'border border-red-300/60 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 text-red-700 dark:text-red-300'
            : 'border border-green-300/60 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 text-green-700 dark:text-green-300')
        }
      >
        <div className="font-medium">
          {hasFailures ? 'Test run completed with failures' : 'All tests passed'}
        </div>
        <div className="text-xs opacity-80 mt-1 flex items-center gap-2">
          <span className="text-green-700 dark:text-green-300">✓ {results.summary.passed}</span>
          <span className="text-red-700 dark:text-red-300">✗ {results.summary.failed}</span>
          <span className="text-amber-700 dark:text-amber-300">○ {results.summary.skipped}</span>
          <span className="text-neutral-600 dark:text-neutral-400">• {results.summary.total} total</span>
          {typeof results.summary.durationMs === 'number' && (
            <span className="text-neutral-600 dark:text-neutral-400">• {totalDur}</span>
          )}
        </div>
      </div>

      {/* Failing tests */}
      {hasFailures && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-red-700 dark:text-red-300">
            {results.summary.failed} failing test{results.summary.failed === 1 ? '' : 's'}
          </div>
          {failing.length === 0 ? (
            <div className="text-xs text-neutral-500">No structured failures detected. See raw outputs below.</div>
          ) : null}

          {failing.map((t, idx) => (
            <div key={`fail-${idx}`} className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3 space-y-2">
              <FileHeader t={t} />
              <div className="space-y-2">
                {(t.failures || []).map((f, i) => (
                  <FailureItem key={i} test={t} failure={f} />
                ))}
              </div>
              <SkipsList t={t} />
              <PassesList t={t} />
              <RawOutput t={t} />
            </div>
          ))}
        </div>
      )}

      {/* Skipped tests */}
      {hasSkips && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {results.summary.skipped} skipped test{results.summary.skipped === 1 ? '' : 's'}
          </div>
          {skippedFiles.map((t, idx) => (
            <div key={`skip-${idx}`} className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3 space-y-2">
              <FileHeader t={t} />
              <SkipsList t={t} />
              <PassesList t={t} />
              <RawOutput t={t} />
            </div>
          ))}
        </div>
      )}

      {/* Passing tests */}
      {hasPasses && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-green-700 dark:text-green-300">
            {results.summary.passed} passing test{results.summary.passed === 1 ? '' : 's'}
          </div>
          {passing.map((t, idx) => (
            <div key={`pass-${idx}`} className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3 space-y-2">
              <FileHeader t={t} />
              <PassesList t={t} />
              <SkipsList t={t} />
              <RawOutput t={t} />
            </div>
          ))}
        </div>
      )}

      {/* If nothing to show (e.g., no tests), provide raw outputs if any */}
      {!hasFailures && !hasSkips && !hasPasses && (
        <div className="text-xs text-neutral-500">No tests found.</div>
      )}
    </div>
  )
}
