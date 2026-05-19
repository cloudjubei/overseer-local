import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { useTests } from '@core/contexts/TestsContext'
import type { TestsRunningJob } from '@core/contexts/TestsContext'
import { useActiveProject } from '@core/contexts/ProjectsContext'
import { useStories } from '@core/contexts/StoriesContext'
import { listTestConfigCandidates, readFile as readFileSdk } from 'thefactory-ui/headless/api'
import {
  Alert,
  Button,
  CoverageTable,
  SegmentedControl,
  TestCustomConfigInput,
  TestResultsList,
  TestsAggregateBar,
  TestsProgressBar,
  type TestConfigCandidate,
} from 'thefactory-ui/web'
import { IconDoubleUp, IconPlay, IconStopCircle } from 'thefactory-ui/web/icons'
import ChatSidebarPanel from '@ui/components/chat/ChatSidebarPanel'
import StoriesModalHost from '@ui/screens/stories/StoriesModalHost'
import type { StoryModalRoute } from '@ui/screens/stories/storyModals'
import LoadingScreen from './LoadingScreen'

const TEST_TABS = [
  { value: 'results', label: 'Results' },
  { value: 'coverage', label: 'Coverage' },
  { value: 'custom', label: 'Custom' },
] as const
type TestTab = (typeof TEST_TABS)[number]['value']

const JOB_KIND_LABEL: Record<TestsRunningJob['kind'], string> = {
  unit: 'Unit tests',
  'unit-all': 'All unit tests',
  coverage: 'Coverage',
  'coverage-all': 'Coverage (all)',
}

function isCoverageJob(job: TestsRunningJob | null): boolean {
  return job?.kind === 'coverage' || job?.kind === 'coverage-all'
}
function isTestsJob(job: TestsRunningJob | null): boolean {
  return job?.kind === 'unit' || job?.kind === 'unit-all'
}

export default function TestsView() {
  // Hard-remount on project switch so every piece of local UI state
  // (selected tab, custom config path, modal route, candidates) clears
  // along with the context's `lastRun` / `lastCoverage`.
  const { projectId } = useActiveProject()
  const { projectId: urlProjectId } = useParams<{ projectId: string }>()
  return <TestsViewInner key={projectId ?? urlProjectId ?? 'no-project'} />
}

function TestsViewInner() {
  const { projectId, project } = useActiveProject()
  const { projectId: urlProjectId } = useParams<{ projectId: string }>()
  const {
    isLoaded,
    loadError,
    lastRun,
    lastCustomRun,
    lastCoverage,
    isRunning,
    runningJob,
    runTests,
    runAllTests,
    runCoverageAll,
    abort,
  } = useTests()
  const { stories, createStory } = useStories()

  const [tab, setTab] = useState<TestTab>('results')
  const [opError, setOpError] = useState<string | null>(null)
  const [customConfigPath, setCustomConfigPath] = useState('')
  const [candidates, setCandidates] = useState<TestConfigCandidate[]>([])
  // env-var values per config path, so switching between chips remembers
  // what the user typed without leaking values between configs.
  const [envByConfig, setEnvByConfig] = useState<Record<string, Record<string, string>>>({})
  const [modal, setModal] = useState<StoryModalRoute | null>(null)

  // Fetch config candidates once per project for the Custom tab.
  useEffect(() => {
    const id = projectId ?? urlProjectId
    if (!id) {
      setCandidates([])
      return
    }
    let cancelled = false
    listTestConfigCandidates({ path: { projectId: id } })
      .then((res) => {
        if (cancelled) return
        const list = (res.data ?? []) as TestConfigCandidate[]
        setCandidates(list)
        // Seed default values so flags / strings declared with `default`
        // are pre-filled on first render.
        setEnvByConfig((prev) => {
          const next = { ...prev }
          for (const c of list) {
            if (!c.env || c.env.length === 0) continue
            const existing = next[c.path] ?? {}
            const seeded = { ...existing }
            for (const v of c.env) {
              if (v.default !== undefined && seeded[v.name] === undefined) {
                seeded[v.name] = v.default
              }
            }
            next[c.path] = seeded
          }
          return next
        })
      })
      .catch(() => {
        if (cancelled) return
        setCandidates([])
      })
    return () => {
      cancelled = true
    }
  }, [projectId, urlProjectId])

  const customEnvValues = envByConfig[customConfigPath] ?? {}
  const setCustomEnvValues = (next: Record<string, string>) => {
    setEnvByConfig((prev) => ({ ...prev, [customConfigPath]: next }))
  }

  // Wire the failing-test code-snippet loader to the SDK's readFile so the
  // lifted `TestResultsList` can render snippets identically on web + desktop.
  // Declared above the loading-state early-returns so the hook order stays
  // stable between the loading and ready renders.
  const readFileForSnippets = useMemo(() => {
    const id = projectId ?? urlProjectId
    if (!id) return undefined
    return async (relPath: string): Promise<string | undefined> => {
      try {
        const res = await readFileSdk({
          path: { projectId: id },
          body: { path: relPath },
          throwOnError: true,
        })
        return res.data.content
      } catch {
        return undefined
      }
    }
  }, [projectId, urlProjectId])

  if (!isLoaded) return <LoadingScreen label="Loading tests…" />
  if (loadError) return <LoadingScreen label="Could not load tests" error={loadError.message} />

  const runOp = async (op: () => Promise<unknown>) => {
    setOpError(null)
    try {
      await op()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  const onAbort = async () => {
    try {
      await abort()
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Abort failed')
    }
  }

  const onRun = () => {
    if (tab === 'results') {
      void runOp(() => runAllTests())
    } else if (tab === 'coverage') {
      void runOp(() => runCoverageAll())
    } else {
      const path = customConfigPath.trim()
      if (!path) return
      // Custom = run the whole project under an alternate runner config.
      // Empty `paths` + `configPath` triggers `runAllTests({ configPath })`
      // on the backend, which writes to the separate custom-run cache.
      // Env values supplied via the per-config input fields are passed
      // through and merged into the spawned runner's `process.env`.
      const env = envByConfig[path]
      void runOp(() =>
        runTests({
          paths: [],
          configPath: path,
          ...(env && Object.keys(env).length > 0 ? { env } : {}),
        }),
      )
    }
  }

  const primaryDisabled = isRunning || (tab === 'custom' && customConfigPath.trim().length === 0)

  // Coverage "Improve tests" action: ensure a TESTING story exists, then
  // open the create-feature modal pre-filled with the file/uncovered lines.
  // Mirrors desktop's `onImproveTestsClick`.
  const onImproveTests = async (file: string, uncovered: number[]) => {
    const existing = stories.find(
      (s) => typeof s.title === 'string' && s.title.trim().toUpperCase() === 'TESTING',
    )
    let storyId = existing?.id
    if (!storyId) {
      try {
        const created = await createStory({
          title: 'TESTING',
          description: 'Ongoing Testing improvements',
        })
        storyId = created?.id
      } catch {
        return
      }
    }
    if (!storyId) return
    const linesText = uncovered.length > 0 ? uncovered.join(', ') : ''
    const description = [
      `Improve test coverage for @${file} .`,
      linesText ? `Target uncovered lines: ${linesText} .` : undefined,
    ]
      .filter(Boolean)
      .join('\n')
    setModal({
      kind: 'create-feature',
      storyId,
      initialValues: {
        title: `Add tests for ${file}`,
        description,
        status: '-',
        context: [file],
      },
    })
  }

  return (
    <div className="flex w-full h-full overflow-hidden">
      <section className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        <header
          className="flex items-center justify-between gap-4 px-6 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-base)' }}
        >
          <div className="flex items-center gap-3">
            <SegmentedControl
              ariaLabel="Tests view"
              value={tab}
              onChange={(v) => setTab(v as TestTab)}
              options={TEST_TABS.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          {isRunning ? (
            <Button size="sm" variant="danger" onClick={onAbort}>
              <IconStopCircle className="w-4 h-4" />
              Abort
            </Button>
          ) : (
            <Button size="sm" onClick={onRun} disabled={primaryDisabled}>
              <IconPlay className="w-4 h-4" />
              Run
            </Button>
          )}
        </header>

        <div className="flex flex-col gap-3 px-6 pt-4 shrink-0">
          {opError && <Alert>{opError}</Alert>}
          {runningJob && (
            <TestsProgressBar
              label={`${JOB_KIND_LABEL[runningJob.kind]} running…`}
              completed={runningJob.completed}
              total={runningJob.total ?? null}
              currentFile={runningJob.currentFile}
            />
          )}
          {tab === 'results' && lastRun && !isTestsJob(runningJob) && (
            <TestsAggregateBar results={lastRun} />
          )}
          {tab === 'custom' && lastCustomRun && !isTestsJob(runningJob) && (
            <TestsAggregateBar results={lastCustomRun} />
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-6 pt-3 pb-6">
          {tab === 'results' && <ResultsPane lastRun={lastRun} readFile={readFileForSnippets} />}
          {tab === 'coverage' && (
            <CoveragePane
              lastCoverage={lastCoverage}
              isRunningCoverage={isCoverageJob(runningJob)}
              onImproveTests={onImproveTests}
            />
          )}
          {tab === 'custom' && (
            <CustomPane
              configPath={customConfigPath}
              onChangeConfig={setCustomConfigPath}
              candidates={candidates}
              envValues={customEnvValues}
              onEnvChange={setCustomEnvValues}
              isRunning={isRunning}
              lastRun={lastCustomRun}
              readFile={readFileForSnippets}
            />
          )}
        </div>
      </section>

      {(projectId || urlProjectId) && (
        <ChatSidebarPanel
          context={{
            type: 'PROJECT_TOPIC',
            projectId: (projectId ?? urlProjectId) as string,
            topicId: 'tests',
          }}
          chatContextTitle={project ? `Tests — ${project.title}` : 'Tests chat'}
        />
      )}

      <StoriesModalHost route={modal} onClose={() => setModal(null)} />
    </div>
  )
}

function ResultsPane({
  lastRun,
  readFile,
}: {
  lastRun: Parameters<typeof TestResultsList>[0]['results'] | null
  readFile?: (relPath: string) => Promise<string | undefined>
}) {
  if (!lastRun) return <p className="text-sm opacity-70">Run tests to see results.</p>
  return <TestResultsList results={lastRun} readFile={readFile} />
}

function CoveragePane({
  lastCoverage,
  isRunningCoverage,
  onImproveTests,
}: {
  lastCoverage: Parameters<typeof CoverageTable>[0]['data'] | null
  isRunningCoverage: boolean
  onImproveTests: (file: string, uncovered: number[]) => void | Promise<void>
}) {
  if (!lastCoverage && !isRunningCoverage)
    return <p className="text-sm opacity-70">Run coverage to see the report.</p>
  if (!lastCoverage) return null
  if (lastCoverage.status === 'error') {
    return <Alert>{lastCoverage.message ?? 'Coverage run failed.'}</Alert>
  }
  return (
    <CoverageTable
      data={lastCoverage}
      renderActions={(file, uncovered) => (
        <Button size="sm" variant="secondary" onClick={() => void onImproveTests(file, uncovered)}>
          <div className="flex flex-col items-center leading-none">
            <IconDoubleUp className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Tests</span>
          </div>
        </Button>
      )}
    />
  )
}

function CustomPane({
  configPath,
  onChangeConfig,
  candidates,
  envValues,
  onEnvChange,
  isRunning,
  lastRun,
  readFile,
}: {
  configPath: string
  onChangeConfig: (next: string) => void
  candidates: TestConfigCandidate[]
  envValues: Record<string, string>
  onEnvChange: (next: Record<string, string>) => void
  isRunning: boolean
  lastRun: Parameters<typeof TestResultsList>[0]['results'] | null
  readFile?: (relPath: string) => Promise<string | undefined>
}) {
  return (
    <div className="flex flex-col gap-3">
      <TestCustomConfigInput
        value={configPath}
        onChange={onChangeConfig}
        candidates={candidates}
        envValues={envValues}
        onEnvChange={onEnvChange}
        disabled={isRunning}
        helperText="Provide the path to a custom test config (e.g. Playwright, Cypress, or a vitest.e2e.config.ts). Chips below are detected in your project."
      />
      {lastRun ? (
        <TestResultsList results={lastRun} readFile={readFile} />
      ) : (
        <p className="text-sm opacity-70">Run a custom config to see results.</p>
      )}
    </div>
  )
}
