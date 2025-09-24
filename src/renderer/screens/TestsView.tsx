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

  // Only show the CTA when there are truly no tests and no last results to display
  const showNoTestsCta =
    activeTab === 'results' &&
    !isRunningTests &&
    !isLoadingCatalog &&
    (testsCatalog?.length ?? 0) === 0 &&
    !results &&
    !testsError

  const isResults = activeTab === 'results'

  const actionButton = isResults ? (
    <Button onClick={() => runTests()} loading={isRunningTests} variant="primary" size="lg">
      Run Tests
    </Button>
  ) : (
    <Button onClick={() => runCoverage()} loading={isRunningCoverage} variant="primary" size="lg">
      Run Coverage
    </Button>
  )

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-lg font-semibold">Tests</div>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          Run tests and view coverage
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex items-center gap-3">
          <SegmentedControl
            ariaLabel="Tests view tabs"
            value={activeTab}
            onChange={(v) => setActiveTab(v as 'results' | 'coverage')}
            options={[
              { value: 'results', label: 'Test Results' },
              { value: 'coverage', label: 'Test Coverage' },
            ]}
          />
          <div className="ml-auto flex items-center gap-3">{actionButton}</div>
        </div>

        {isResults && (
          <div className="flex-1 min-h-0 rounded-md border border-neutral-200 dark:border-neutral-800 flex flex-col">
            <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 text-sm text-neutral-600 dark:text-neutral-400">
              All tests will be run.
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
              {testsError ? (
                <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
                  {testsError}
                </div>
              ) : null}

              {showNoTestsCta && (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center max-w-xl">
                    <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                      No tests detected in this project. Kickstart testing by creating a feature to
                      set up the testing framework and add coverage.
                    </div>
                    <Button variant="secondary" onClick={onCreateTestsFeatureClick}>
                      Create feature to add tests
                    </Button>
                  </div>
                </div>
              )}

              {!isRunningTests && !testsError && results && <TestResultsView results={results} />}

              {isRunningTests && (
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <Spinner size={14} label="Running tests..." />
                </div>
              )}

              {!isRunningTests && !testsError && !results && !showNoTestsCta && (
                <div className="text-sm text-neutral-500">Click "Run Tests" to start.</div>
              )}
            </div>
          </div>
        )}

        {!isResults && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              {coverageError ? (
                <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap p-4">
                  {coverageError}
                </div>
              ) : null}

              {!isRunningCoverage && !coverageError && coverage && (
                <div className="h-full">
                  <CoverageReport data={coverage} />
                </div>
              )}

              {!isRunningCoverage && !coverageError && !coverage && (
                <div className="text-sm text-neutral-500 p-4">Click "Run Coverage" to start.</div>
              )}

              {isRunningCoverage && (
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 p-4">
                  <Spinner size={14} label="Running coverage..." />
                </div>
              )}
            </div>
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
