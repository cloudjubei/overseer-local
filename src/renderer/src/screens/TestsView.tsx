import React from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'
import { Button } from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import TestResultsView from '../components/tests/TestResults'
import CoverageReport from '../components/tests/CoverageReport'
import { TestsProvider, useTests } from '../contexts/TestsContext'
import { useNavigator } from '../navigation/Navigator'
import { useStories } from '../contexts/StoriesContext'
import { useActiveProject } from '../contexts/ProjectContext'
import { ChatSidebarPanel } from '../components/chat'
import { ChatContext } from 'thefactory-tools'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { Input } from '../components/ui/Input'

function TestsInner() {
  const [activeTab, setActiveTab] = React.useState<'results' | 'e2e' | 'coverage'>('results')
  const [e2eCommand, setE2ECommand] = React.useState<string>('')

  const { appSettings, setUserPreferences } = useAppSettings()

  const {
    isRunningTests,
    isRunningE2ETests,
    isRunningCoverage,
    results,
    resultsE2E,
    coverage,
    testsError,
    testsErrorE2E,
    coverageError,
    runTests,
    runTestsE2E,
    runCoverage,
    testsCatalog,
    isLoadingCatalog,
  } = useTests()

  const { openModal } = useNavigator()
  const { storyIdsByProject, storiesById, createStory } = useStories()
  const { projectId } = useActiveProject()

  const chatContext: ChatContext | undefined = React.useMemo(() => {
    if (!projectId) return undefined
    return {
      type: 'PROJECT_TOPIC',
      projectId,
      projectTopic: 'tests',
    }
  }, [projectId])

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
  const isE2E = activeTab === 'e2e'
  const isCoverage = activeTab === 'coverage'

  const actionButton = isResults ? (
    <Button onClick={() => runTests()} loading={isRunningTests} variant="primary" size="lg">
      Run Tests
    </Button>
  ) : isE2E ? (
    <Button
      onClick={() => runTestsE2E(e2eCommand.length > 0 ? e2eCommand : undefined)}
      loading={isRunningE2ETests}
      variant="primary"
      size="lg"
    >
      Run E2E Tests
    </Button>
  ) : (
    <Button onClick={() => runCoverage()} loading={isRunningCoverage} variant="primary" size="lg">
      Run Coverage
    </Button>
  )

  return (
    <div className="flex flex-row flex-1 min-h-0 min-w-0 w-full overflow-hidden">
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Tests</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                Run tests and view coverage
              </div>
            </div>
            <div className="flex items-center gap-2"></div>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-4 flex-1 min-h-0 min-w-0">
          <div className="flex items-center gap-3">
            <SegmentedControl
              ariaLabel="Tests view tabs"
              value={activeTab}
              onChange={(v) => setActiveTab(v as 'results' | 'e2e' | 'coverage')}
              options={[
                { value: 'results', label: 'Test Results' },
                { value: 'e2e', label: 'E2E Tests' },
                { value: 'coverage', label: 'Test Coverage' },
              ]}
            />
            <div className="ml-auto flex items-center gap-3">{actionButton}</div>
          </div>

          {isResults && (
            <div className="flex-1 min-h-0 min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 flex flex-col">
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
                        No tests detected in this project. Kickstart testing by creating a feature
                        to set up the testing framework and add coverage.
                      </div>
                      <Button variant="secondary" onClick={onCreateTestsFeatureClick}>
                        Create feature to add tests
                      </Button>
                    </div>
                  </div>
                )}

                {!isRunningTests && !testsError && results && (
                  <TestResultsView projectId={projectId} results={results} />
                )}

                {!isRunningTests && !testsError && !results && !showNoTestsCta && (
                  <div className="text-sm text-neutral-500">Click "Run Tests" to start.</div>
                )}
              </div>
            </div>
          )}

          {isE2E && (
            <div className="flex-1 min-h-0 min-w-0 rounded-md border border-neutral-200 dark:border-neutral-800 flex flex-col">
              <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-900 text-sm text-neutral-600 dark:text-neutral-400">
                <p className="mb-2">Run End-to-End (E2E) tests.</p>
                <p className="text-xs mb-2">
                  By default, this will run the `test:e2e` script from your project's
                  `package.json`.
                </p>
                <Input
                  placeholder="Override command (optional)"
                  value={e2eCommand}
                  onChange={(e) => setE2ECommand(e.target.value)}
                />
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
                {testsErrorE2E ? (
                  <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
                    {testsErrorE2E}
                  </div>
                ) : null}

                {isRunningE2ETests && (
                  <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <Spinner size={14} label="Running E2E tests..." />
                  </div>
                )}

                {!isRunningE2ETests && !testsErrorE2E && resultsE2E && (
                  <TestResultsView projectId={projectId} results={resultsE2E} />
                )}

                {!isRunningE2ETests && !testsErrorE2E && !resultsE2E && (
                  <div className="text-sm text-neutral-500">Click "Run E2E Tests" to start.</div>
                )}
              </div>
            </div>
          )}

          {isCoverage && (
            <div className="flex-1 min-h-0 min-w-0 flex flex-col">
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                {coverageError ? (
                  <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap p-4">
                    {coverageError}
                  </div>
                ) : null}

                {!isRunningCoverage && !coverageError && coverage && (
                  <div className="h-full min-w-0">
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

      {chatContext && (
        <ChatSidebarPanel
          context={chatContext}
          chatContextTitle="Tests chat"
          initialWidth={appSettings.userPreferences.chatSidebarWidth || 420}
          onWidthChange={(w, final) => {
            if (final) setUserPreferences({ chatSidebarWidth: Math.round(w) })
          }}
        />
      )}
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
