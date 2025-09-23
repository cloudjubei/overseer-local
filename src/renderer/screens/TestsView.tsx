import React from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'
import { Button } from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import TestResultsView from '../components/tests/TestResults'
import CoverageReport from '../components/tests/CoverageReport'
import { TestsProvider, useTests } from '../contexts/TestsContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select'
import { TimeAgo } from '../components/agents/time'

function TestsInner() {
  const [activeTab, setActiveTab] = React.useState<'results' | 'coverage'>('results')

  const [selectedTestScope, setSelectedTestScope] = React.useState<string>('.')
  const [selectedCoverageScope, setSelectedCoverageScope] = React.useState<string>('.')

  const {
    isRunningTests,
    isRunningCoverage,
    isLoadingCatalog,
    results,
    coverage,
    testsError,
    coverageError,
    runTests,
    runCoverage,
    resultsInvalidated,
    coverageInvalidated,
    resultsAt,
    coverageAt,
    testsCatalog,
    refreshTestsCatalog,
  } = useTests()

  React.useEffect(() => {
    // Ensure catalog is available on mount
    refreshTestsCatalog()
  }, [])

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
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Select value={selectedTestScope} onValueChange={setSelectedTestScope}>
                  <SelectTrigger aria-label="Select test scope" className="min-w-[260px]">
                    <SelectValue placeholder="Select tests to run" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=".">All tests</SelectItem>
                    {testsCatalog.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingCatalog && <Spinner size={14} label="Loading tests..." />}
                <Button size="sm" variant="secondary" onClick={refreshTestsCatalog}>
                  Refresh
                </Button>
              </div>
              <div className="flex-1" />
              <Button
                onClick={() => runTests(selectedTestScope)}
                loading={isRunningTests}
                variant="primary"
              >
                Run Tests
              </Button>
              {isRunningTests ? <Spinner size={16} label="Running tests..." /> : null}
            </div>

            {results && (
              <div className="flex items-center justify-between text-xs">
                <div>
                  {resultsInvalidated ? (
                    <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      Results are outdated (files changed since last run)
                    </span>
                  ) : resultsAt ? (
                    <span className="text-neutral-500">
                      Last updated <span>{TimeAgo({ ts: resultsAt })}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            {testsError ? (
              <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
                {testsError}
              </div>
            ) : null}

            {!isRunningTests && !testsError && results && <TestResultsView results={results} />}

            {!isRunningTests && !testsError && !results && (
              <div className="text-sm text-neutral-500">Click "Run Tests" to start.</div>
            )}
          </div>
        )}

        {activeTab === 'coverage' && (
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Select value={selectedCoverageScope} onValueChange={setSelectedCoverageScope}>
                  <SelectTrigger aria-label="Select coverage scope" className="min-w-[260px]">
                    <SelectValue placeholder="Select coverage scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=".">All files</SelectItem>
                    {testsCatalog.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingCatalog && <Spinner size={14} label="Loading..." />}
              </div>
              <div className="flex-1" />
              <Button
                onClick={() => runCoverage(selectedCoverageScope)}
                loading={isRunningCoverage}
                variant="primary"
              >
                Run Coverage
              </Button>
              {isRunningCoverage ? <Spinner size={16} label="Running coverage..." /> : null}
            </div>

            {coverage && (
              <div className="flex items-center justify-between text-xs">
                <div>
                  {coverageInvalidated ? (
                    <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      Coverage is outdated (files changed since last run)
                    </span>
                  ) : coverageAt ? (
                    <span className="text-neutral-500">
                      Last updated <TimeAgo ts={coverageAt} />
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            {coverageError ? (
              <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
                {coverageError}
              </div>
            ) : null}

            {!isRunningCoverage && !coverageError && coverage && <CoverageReport data={coverage} />}

            {!isRunningCoverage && !coverageError && !coverage && (
              <div className="text-sm text-neutral-500">Click "Run Coverage" to start.</div>
            )}

            {!isRunningCoverage && !coverageError && coverage && (coverage as any).rawText && (
              <details className="mt-2">
                <summary className="text-xs text-neutral-500 cursor-pointer">
                  View raw output
                </summary>
                <pre className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap break-all max-h-64 overflow-auto bg-neutral-50 dark:bg-neutral-900 p-2 rounded">
                  {(coverage as any).rawText}
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
