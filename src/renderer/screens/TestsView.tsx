import React from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'
import { Button } from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import TestResultsView from '../components/tests/TestResults'
import { Input } from '../components/ui/Input'
import CoverageReport from '../components/tests/CoverageReport'
import { TestsProvider, useTests } from '../contexts/TestsContext'

function TestsInner() {
  const [activeTab, setActiveTab] = React.useState<'results' | 'coverage'>('results')

  const [testsPath, setTestsPath] = React.useState('')
  const [coveragePath, setCoveragePath] = React.useState('')

  const {
    isRunningTests,
    isRunningCoverage,
    results,
    coverage,
    testsError,
    coverageError,
    runTests,
    runCoverage,
  } = useTests()

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
              <Button onClick={() => runTests(testsPath)} loading={isRunningTests} variant="primary">
                Run Tests
              </Button>
              {isRunningTests ? <Spinner size={16} label="Running tests..." /> : null}
            </div>

            {testsError ? (
              <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
                {testsError}
              </div>
            ) : null}

            {!isRunningTests && !testsError && results && <TestResultsView results={results} />}

            {!isRunningTests && !testsError && !results && (
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
              <Button
                onClick={() => runCoverage(coveragePath)}
                loading={isRunningCoverage}
                variant="primary"
              >
                Run Coverage
              </Button>
              {isRunningCoverage ? <Spinner size={16} label="Running coverage..." /> : null}
            </div>

            {coverageError ? (
              <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
                {coverageError}
              </div>
            ) : null}

            {!isRunningCoverage && !coverageError && coverage && <CoverageReport data={coverage} />}

            {!isRunningCoverage && !coverageError && !coverage && (
              <div className="text-sm text-neutral-500">Enter a path and click "Run Coverage".</div>
            )}

            {!isRunningCoverage && !coverageError && coverage && coverage.rawText && (
              <details className="mt-2">
                <summary className="text-xs text-neutral-500 cursor-pointer">View raw output</summary>
                <pre className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap break-all max-h-64 overflow-auto bg-neutral-50 dark:bg-neutral-900 p-2 rounded">
                  {coverage.rawText}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TestsView() {
  return (
    <TestsProvider>
      <TestsInner />
    </TestsProvider>
  )
}
