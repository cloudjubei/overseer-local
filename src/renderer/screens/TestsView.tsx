import React from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'
import { Button } from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { factoryTestsService } from '../services/factoryTestsService'
import TestResultsView from '../components/tests/TestResults'
import { parseTestOutput, ParsedTestResults, ParsedFailure } from '../utils/testResults'
import { Input } from '../components/ui/Input'
import CoverageReport from '../components/tests/CoverageReport'
import { parseCoverageOutput, ParsedCoverage } from '../utils/coverage'
import { useActiveProject } from '../contexts/ProjectContext'
import type { TestResult } from 'thefactory-tools'

function mapTestResultToParsed(res: TestResult): ParsedTestResults {
  // Build raw text for fallback viewing
  const rawText = (() => {
    const chunks: string[] = []
    const anyRes: any = res as any
    if (typeof anyRes.stdout === 'string' && anyRes.stdout.length) chunks.push(anyRes.stdout)
    if (typeof anyRes.stderr === 'string' && anyRes.stderr.length) chunks.push(anyRes.stderr)
    if (chunks.length) return chunks.join('\n')
    try {
      return JSON.stringify(res, null, 2)
    } catch {
      return String(res)
    }
  })()

  // Determine ok status defensively
  const anyRes: any = res as any
  const status: string | undefined = typeof anyRes.status === 'string' ? anyRes.status : undefined
  const ok: boolean =
    typeof anyRes.ok === 'boolean'
      ? anyRes.ok
      : status
      ? /^(ok|pass|passed|success)$/i.test(status)
      : Array.isArray(anyRes.failures)
      ? anyRes.failures.length === 0
      : true

  // Map failures if present
  const failures: ParsedFailure[] = []
  if (Array.isArray((anyRes as any).failures)) {
    for (const f of (anyRes as any).failures) {
      if (!f) continue
      failures.push({
        testName: (f as any).testName || (f as any).title || (f as any).name,
        filePath: (f as any).filePath || (f as any).file || (f as any).path,
        line: typeof (f as any).line === 'number' ? (f as any).line : null,
        column: typeof (f as any).column === 'number' ? (f as any).column : null,
        message:
          (f as any).message ||
          (Array.isArray((f as any).messages) ? (f as any).messages.join('\n') : undefined) ||
          'Test failed',
        stack: (f as any).stack,
      })
    }
  }

  // Map summary if available
  const summarySrc: any = (anyRes.summary || anyRes.stats || anyRes.result || {}) as any
  const summary = {
    total:
      typeof summarySrc.total === 'number'
        ? summarySrc.total
        : typeof summarySrc.numTotalTests === 'number'
        ? summarySrc.numTotalTests
        : undefined,
    passed:
      typeof summarySrc.passed === 'number'
        ? summarySrc.passed
        : typeof summarySrc.numPassedTests === 'number'
        ? summarySrc.numPassedTests
        : undefined,
    failed:
      typeof summarySrc.failed === 'number'
        ? summarySrc.failed
        : typeof summarySrc.numFailedTests === 'number'
        ? summarySrc.numFailedTests
        : undefined,
    skipped:
      typeof summarySrc.skipped === 'number'
        ? summarySrc.skipped
        : typeof summarySrc.numPendingTests === 'number'
        ? summarySrc.numPendingTests
        : undefined,
    durationMs:
      typeof summarySrc.durationMs === 'number'
        ? summarySrc.durationMs
        : typeof summarySrc.runtime === 'number'
        ? summarySrc.runtime
        : typeof summarySrc.time === 'number'
        ? summarySrc.time
        : undefined,
  }

  return {
    ok,
    rawText,
    failures,
    summary,
  }
}

export default function TestsView() {
  const { projectId } = useActiveProject()

  const [activeTab, setActiveTab] = React.useState<'results' | 'coverage'>('results')

  // Tests state
  const [testsPath, setTestsPath] = React.useState('')
  const [isRunning, setIsRunning] = React.useState(false)
  const [results, setResults] = React.useState<ParsedTestResults | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Coverage state
  const [coveragePath, setCoveragePath] = React.useState('')
  const [isRunningCoverage, setIsRunningCoverage] = React.useState(false)
  const [coverageError, setCoverageError] = React.useState<string | null>(null)
  const [coverageParsed, setCoverageParsed] = React.useState<ParsedCoverage | null>(null)

  const runTests = async () => {
    setIsRunning(true)
    setError(null)
    setResults(null)
    try {
      const path = testsPath?.trim() || undefined
      const res = await factoryTestsService.runTests(projectId, path)
      const parsed = mapTestResultToParsed(res)
      setResults(parsed)
      if (!parsed.ok) {
        // keep failures displayed; no explicit error unless missing output
      }
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setIsRunning(false)
    }
  }

  const runCoverage = async () => {
    setIsRunningCoverage(true)
    setCoverageError(null)
    setCoverageParsed(null)
    try {
      const path = coveragePath?.trim() || undefined
      const res = await factoryTestsService.runCoverage(projectId, path)
      // parseCoverageOutput can consume objects with various shapes
      const parsed = parseCoverageOutput(res as any)
      setCoverageParsed(parsed)
    } catch (e: any) {
      setCoverageError(e?.message || String(e))
    } finally {
      setIsRunningCoverage(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-lg font-semibold">Tests</div>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          Run tests and view coverage
        </div>
      </div>

      <div className="p-4 space-y-4">
        <SegmentedControl
          ariaLabel="Tests view tabs"
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'results' | 'coverage')}
          options={[
            { value: 'results', label: 'Test Results' },
            { value: 'coverage', label: 'Test Coverage' },
          ]}
        />

        {activeTab === 'results' && (
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Optional: Enter test path (e.g., src/components/MyComponent.test.ts)"
                  value={testsPath}
                  onChange={(e) => setTestsPath(e.target.value)}
                />
              </div>
              <Button onClick={runTests} loading={isRunning} variant="primary">
                Run Tests
              </Button>
              {isRunning ? <Spinner size={16} label="Running tests..." /> : null}
            </div>

            {error ? (
              <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
                {error}
              </div>
            ) : null}

            {!isRunning && !error && results && <TestResultsView results={results} />}

            {!isRunning && !error && !results && (
              <div className="text-sm text-neutral-500">
                No test results yet. Click "Run Tests" to start.
              </div>
            )}
          </div>
        )}

        {activeTab === 'coverage' && (
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Optional: Enter path (e.g., src/components/) to scope coverage"
                  value={coveragePath}
                  onChange={(e) => setCoveragePath(e.target.value)}
                />
              </div>
              <Button onClick={runCoverage} loading={isRunningCoverage} variant="primary">
                Run Coverage
              </Button>
              {isRunningCoverage ? <Spinner size={16} label="Running coverage..." /> : null}
            </div>

            {coverageError ? (
              <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
                {coverageError}
              </div>
            ) : null}

            {!isRunningCoverage && !coverageError && coverageParsed && (
              <CoverageReport data={coverageParsed} />
            )}

            {!isRunningCoverage && !coverageError && !coverageParsed && (
              <div className="text-sm text-neutral-500">
                Enter a path and click "Run Coverage".
              </div>
            )}

            {!isRunningCoverage && !coverageError && coverageParsed && coverageParsed.rawText && (
              <details className="mt-2">
                <summary className="text-xs text-neutral-500 cursor-pointer">
                  View raw output
                </summary>
                <pre className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap break-all max-h-64 overflow-auto bg-neutral-50 dark:bg-neutral-900 p-2 rounded">
                  {coverageParsed.rawText}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
