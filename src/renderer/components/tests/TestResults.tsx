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
  const testName = failure.testName
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

export default function TestResultsView({ results }: { results: TestsResult }) {
  console.log('results: ', results)
  //TODO: improve this display to show the stats per TestResult in results.tests
  if (results.status == 'ok') {
    return (
      <div className="rounded-md border border-green-300/50 dark:border-green-800 p-4 bg-green-50/50 dark:bg-green-900/10">
        <div className="text-sm font-medium text-green-700 dark:text-green-300">
          All tests passed
        </div>
        {results.summary && (
          <div className="text-xs text-green-700/80 dark:text-green-300/80 mt-1">
            {typeof results.summary.passed === 'number'
              ? `${results.summary.passed} passed`
              : 'Passed'}
            {typeof results.summary.total === 'number' ? ` • ${results.summary.total} total` : ''}
          </div>
        )}
      </div>
    )
  }
  //TODO: not ok which means that there are either skips or failures
  const hasSkips = results.summary.skipped > 0
  const hasFailures = results.summary.failed > 0
  return (
    <div className="space-y-3">
      {hasFailures ? (
        <div className="text-sm font-medium text-red-700 dark:text-red-300">
          {results.summary.failed} failing test{results.summary.failed === 1 ? '' : 's'}
        </div>
      ) : (
        <div className="text-sm text-neutral-500">
          No structured failures detected. Raw output below.
        </div>
      )}

      {hasFailures && (
        <div className="space-y-3">
          {/* {results.tests.map((f, i) => (
            <FailureItem key={i} failure={f} />
          ))} */}
        </div>
      )}
    </div>
  )
}
