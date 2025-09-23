import React from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'
import { Button } from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { testsService } from '../services/testsService'
import TestResultsView from '../components/tests/TestResults'
import { parseTestOutput, ParsedTestResults } from '../utils/testResults'
import { Input } from '../components/ui/Input'

export default function TestsView() {
  const [activeTab, setActiveTab] = React.useState<'results' | 'coverage'>('results')
  const [isRunning, setIsRunning] = React.useState(false)
  const [results, setResults] = React.useState<ParsedTestResults | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Coverage state
  const [coveragePath, setCoveragePath] = React.useState('')
  const [isRunningCoverage, setIsRunningCoverage] = React.useState(false)
  const [coverageError, setCoverageError] = React.useState<string | null>(null)
  const [coverageRaw, setCoverageRaw] = React.useState<any | null>(null)

  const runTests = async () => {
    setIsRunning(true)
    setError(null)
    setResults(null)
    try {
      const res = await testsService.runTests()
      if (!res?.ok) {
        setError(typeof res?.raw === 'string' ? res.raw : 'Failed to run tests')
      } else {
        const parsed = parseTestOutput(res.raw)
        setResults(parsed)
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
    setCoverageRaw(null)
    try {
      const path = coveragePath?.trim()
      const res = await testsService.runCoverage({ path })
      if (!res?.ok) {
        setCoverageError(typeof res?.raw === 'string' ? res.raw : 'Failed to run coverage')
      } else {
        setCoverageRaw(res.raw)
      }
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
        <div className="text-sm text-neutral-600 dark:text-neutral-400">Run tests and view coverage</div>
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
              <Button onClick={runTests} loading={isRunning} variant="primary">
                Run Tests
              </Button>
              {isRunning ? <Spinner size={16} label="Running tests..." /> : null}
            </div>

            {error ? (
              <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</div>
            ) : null}

            {!isRunning && !error && results && <TestResultsView results={results} />}

            {!isRunning && !error && !results && (
              <div className="text-sm text-neutral-500">No test results yet. Click "Run Tests" to start.</div>
            )}
          </div>
        )}

        {activeTab === 'coverage' && (
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Enter test file path (e.g., src/components/MyComponent.spec.ts)"
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
              <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{coverageError}</div>
            ) : null}

            {!isRunningCoverage && !coverageError && coverageRaw && (
              <div className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap break-all max-h-64 overflow-auto bg-neutral-50 dark:bg-neutral-900 p-2 rounded">
                {typeof coverageRaw === 'string' ? coverageRaw : JSON.stringify(coverageRaw, null, 2)}
              </div>
            )}

            {!isRunningCoverage && !coverageError && !coverageRaw && (
              <div className="text-sm text-neutral-500">Enter a test file path and click "Run Coverage".</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
