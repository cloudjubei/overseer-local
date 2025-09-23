import React from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'
import { Button } from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import TestResultsView from '../components/tests/TestResults'
import CoverageReport from '../components/tests/CoverageReport'
import { TestsProvider, useTests } from '../contexts/TestsContext'
import { timeAgo } from '../components/agents/time'
import { useNavigator } from '../navigation/Navigator'
import { useStories } from '../contexts/StoriesContext'
import { useActiveProject } from '../contexts/ProjectContext'

function TimeAgo({ ts }: { ts: number }) {
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  const text = timeAgo(now, ts)
  return <span>{text}</span>
}

function TestsInner() {
  const [activeTab, setActiveTab] = React.useState<'results' | 'coverage'>('results')

  const {
    isRunningTests,
    isRunningCoverage,
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
    isLoadingCatalog,
  } = useTests()

  const { openModal } = useNavigator()
  const { storyIdsByProject, storiesById, createStory } = useStories()
  const { projectId } = useActiveProject()

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

  async function onCreateTestsFeatureClick() {
    const storyId = await ensureTestingStory()
    if (!storyId) return

    const title = 'Set up tests and improve coverage'
    const description = [
      'Initialize and configure the test framework for this project (e.g., Vitest/Jest or Pytest as appropriate).',
      'Establish base test utilities, fixtures, and CI integration.',
      'Author comprehensive unit and integration tests across src/, prioritizing critical paths and uncovered code.',
    ].join('\n\n')

    openModal({
      type: 'feature-create',
      storyId,
      initialValues: {
        title,
        description,
        status: '-',
        context: ['src/'],
      },
      focusDescription: true,
    })
  }

  const showNoTestsCta =
    activeTab === 'results' && !isRunningTests && !isLoadingCatalog && (testsCatalog?.length ?? 0) === 0

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
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                All tests will be run.
              </div>
              <div className="flex-1" />
              <Button
                onClick={() => runTests()}
                loading={isRunningTests}
                variant="primary"
              >
                Run Tests
              </Button>
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
                      Last updated <TimeAgo ts={resultsAt} />
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

            {showNoTestsCta && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center max-w-xl">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                    No tests detected in this project. Kickstart testing by creating a feature to set up
                    the testing framework and add coverage.
                  </div>
                  <Button variant="secondary" onClick={onCreateTestsFeatureClick}>
                    Create feature to add tests
                  </Button>
                </div>
              </div>
            )}

            {!isRunningTests && !testsError && results && <TestResultsView results={results} />}

            {!isRunningTests && !testsError && !results && !showNoTestsCta && (
              <div className="text-sm text-neutral-500">Click "Run Tests" to start.</div>
            )}

            {isRunningTests && (
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <Spinner size={14} label="Running tests..." />
              </div>
            )}
          </div>
        )}

        {activeTab === 'coverage' && (
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                Coverage will be collected for all files.
              </div>
              <div className="flex-1" />
              <Button
                onClick={() => runCoverage()}
                loading={isRunningCoverage}
                variant="primary"
              >
                Run Coverage
              </Button>
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

            {isRunningCoverage && (
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <Spinner size={14} label="Running coverage..." />
              </div>
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
