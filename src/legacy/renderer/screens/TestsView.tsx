import React from 'react'

import {
  Alert,
  Button,
  CoverageTable,
  SegmentedControl,
  TEST_CONFIG_PATTERN,
  TestCustomConfigInput,
  TestResultsList,
  TestsAggregateBar,
  TestsProgressBar,
  type TestConfigCandidate,
} from 'thefactory-ui/web'
import { IconDoubleUp, IconPlay, IconStopCircle } from 'thefactory-ui/web/icons'
import type { ChatContext } from 'thefactory-tools'

import { TestsProvider, useTests } from '../contexts/TestsContext'
import { useFiles } from '../contexts/FilesContext'
import { useNavigator } from '../navigation/Navigator'
import { useStories } from '../contexts/StoriesContext'
import { useActiveProject } from '../contexts/ProjectContext'
import { ChatSidebarPanel } from '../components/chat'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { filesService } from '../services/filesService'

const TEST_TABS = [
  { value: 'results', label: 'Results' },
  { value: 'coverage', label: 'Coverage' },
  { value: 'custom', label: 'Custom' },
] as const
type TestTab = (typeof TEST_TABS)[number]['value']

function TestsInner() {
  const [tab, setTab] = React.useState<TestTab>('results')
  const [customConfigPath, setCustomConfigPath] = React.useState<string>('')
  const [packageMeta, setPackageMeta] = React.useState<TestConfigCandidate[]>([])
  const [envByConfig, setEnvByConfig] = React.useState<
    Record<string, Record<string, string>>
  >({})

  const { appSettings, setUserPreferences } = useAppSettings()

  const {
    isRunningTests,
    isRunningCustomTests,
    isRunningCoverage,
    results,
    resultsCustom,
    coverage,
    testsError,
    testsErrorCustom,
    coverageError,
    runAllTests,
    runTestsCustom,
    runAllCoverages,
    testsCatalog,
    isLoadingCatalog,
  } = useTests()

  const { openModal } = useNavigator()
  const { storyIdsByProject, storiesById, createStory } = useStories()
  const { projectId } = useActiveProject()
  const { files } = useFiles()

  // Read declared metadata from `package.json factory.tests.configs[]` so
  // the UI knows what env vars each config wants. Web hits a backend
  // endpoint for this; on desktop we read the file directly via IPC.
  React.useEffect(() => {
    if (!projectId) return
    let cancelled = false
    void (async () => {
      try {
        const raw = await filesService.readFile(projectId, 'package.json', 'utf8')
        if (cancelled || !raw) return
        const parsed = JSON.parse(raw)
        const list = parsed?.factory?.tests?.configs
        if (!Array.isArray(list)) return
        const declared = list
          .filter((d) => d && typeof d.path === 'string' && d.path.trim().length > 0)
          .map((d) => ({
            path: d.path as string,
            ...(typeof d.label === 'string' ? { label: d.label } : {}),
            ...(Array.isArray(d.env) ? { env: d.env } : {}),
          }))
        setPackageMeta(declared)
        // Seed default env values once on first load.
        setEnvByConfig((prev) => {
          const next = { ...prev }
          for (const c of declared) {
            if (!c.env) continue
            const existing = next[c.path] ?? {}
            const seeded = { ...existing }
            for (const v of c.env as Array<{ name: string; default?: string }>) {
              if (v && typeof v.default === 'string' && seeded[v.name] === undefined) {
                seeded[v.name] = v.default
              }
            }
            next[c.path] = seeded
          }
          return next
        })
      } catch {
        // package.json missing or malformed — silently fall back to bare candidates.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  // Discovered configs from the file index, merged with declared metadata
  // so candidates from `package.json` come through even if they don't
  // match the auto-discovery regex (and vice versa).
  const configCandidates = React.useMemo<TestConfigCandidate[]>(() => {
    const discovered = files
      .map((f) => f.relativePath ?? '')
      .filter((p) => p && TEST_CONFIG_PATTERN.test(p))
    const declaredByPath = new Map(packageMeta.map((d) => [d.path, d]))
    const seen = new Set<string>()
    const merged: string[] = []
    for (const p of discovered) {
      if (!seen.has(p)) {
        seen.add(p)
        merged.push(p)
      }
    }
    for (const d of packageMeta) {
      if (!seen.has(d.path)) {
        seen.add(d.path)
        merged.push(d.path)
      }
    }
    return merged
      .sort((a, b) => {
        const da = a.split('/').length
        const db = b.split('/').length
        if (da !== db) return da - db
        return a.localeCompare(b)
      })
      .map((path) => {
        const meta = declaredByPath.get(path)
        return {
          path,
          ...(meta?.label !== undefined ? { label: meta.label } : {}),
          ...(meta?.env !== undefined ? { env: meta.env } : {}),
        }
      })
  }, [files, packageMeta])

  const customEnvValues = envByConfig[customConfigPath] ?? {}
  const setCustomEnvValues = (next: Record<string, string>) => {
    setEnvByConfig((prev) => ({ ...prev, [customConfigPath]: next }))
  }

  const chatContext: ChatContext | undefined = React.useMemo(() => {
    if (!projectId) return undefined
    return {
      type: 'PROJECT_TOPIC',
      projectId,
      projectTopic: 'tests',
    } as ChatContext
  }, [projectId])

  const readFileForSnippets = React.useMemo(() => {
    if (!projectId) return undefined
    return async (relPath: string): Promise<string | undefined> => {
      try {
        const text = await filesService.readFile(projectId, relPath, 'utf8')
        return text ?? undefined
      } catch {
        return undefined
      }
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
      })
      return created?.id
    } catch (e) {
      console.error('Failed to create TESTING story', e)
      return undefined
    }
  }

  async function onImproveCoverageClick(file: string, uncovered: number[]) {
    const storyId = await ensureTestingStory()
    if (!storyId) return
    const rel = file
    const linesText = uncovered.length > 0 ? uncovered.join(', ') : ''
    const title = `Add tests for ${rel}`
    const parts = [
      `Improve test coverage for @${rel} .`,
      linesText ? `Target uncovered lines: ${linesText} .` : undefined,
    ].filter(Boolean) as string[]
    openModal({
      type: 'feature-create',
      storyId,
      initialValues: {
        title,
        description: parts.join('\n'),
        status: '-',
        context: [rel],
      },
      focusDescription: true,
    })
  }

  const isRunning = isRunningTests || isRunningCustomTests || isRunningCoverage
  const primaryDisabled =
    isRunning || (tab === 'custom' && customConfigPath.trim().length === 0)

  const onRun = () => {
    if (tab === 'results') {
      runAllTests()
    } else if (tab === 'coverage') {
      runAllCoverages()
    } else {
      const path = customConfigPath.trim()
      if (!path) return
      const env = envByConfig[path]
      runTestsCustom(path, env && Object.keys(env).length > 0 ? env : undefined)
    }
  }

  const tabError =
    tab === 'results' ? testsError : tab === 'coverage' ? coverageError : testsErrorCustom
  const showNoTestsCta =
    tab === 'results' &&
    !isRunningTests &&
    !isLoadingCatalog &&
    (testsCatalog?.length ?? 0) === 0 &&
    !results &&
    !testsError

  const tabResults =
    tab === 'results' ? results : tab === 'custom' ? resultsCustom : null

  return (
    <div className="flex flex-row flex-1 min-h-0 min-w-0 w-full overflow-hidden">
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">Tests</div>
            <SegmentedControl
              ariaLabel="Tests view"
              value={tab}
              onChange={(v) => setTab(v as TestTab)}
              options={TEST_TABS.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>
          {isRunning ? (
            <Button variant="danger" size="sm">
              <IconStopCircle className="w-4 h-4" />
              Abort
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onRun} disabled={primaryDisabled}>
              <IconPlay className="w-4 h-4" />
              Run
            </Button>
          )}
        </header>

        <div className="flex flex-col gap-3 px-4 pt-4 shrink-0">
          {tabError && (
            <Alert>{tabError}</Alert>
          )}
          {isRunningTests && tab === 'results' && (
            <TestsProgressBar label="Tests running…" completed={0} total={null} />
          )}
          {isRunningCustomTests && tab === 'custom' && (
            <TestsProgressBar label="Custom tests running…" completed={0} total={null} />
          )}
          {isRunningCoverage && tab === 'coverage' && (
            <TestsProgressBar label="Coverage running…" completed={0} total={null} />
          )}
          {tab === 'results' && results && !isRunningTests && (
            <TestsAggregateBar results={results} />
          )}
          {tab === 'custom' && resultsCustom && !isRunningCustomTests && (
            <TestsAggregateBar results={resultsCustom} />
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-4 pt-3 pb-4">
          {tab === 'results' && (
            <>
              {showNoTestsCta && (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center max-w-xl">
                    <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                      No tests detected in this project. Kickstart testing by creating a feature
                      to set up the testing framework and add coverage.
                    </div>
                    <Button variant="secondary" onClick={() => void ensureTestingStory()}>
                      Create feature to add tests
                    </Button>
                  </div>
                </div>
              )}
              {!isRunningTests && !testsError && tabResults && (
                <TestResultsList results={tabResults} readFile={readFileForSnippets} />
              )}
              {!isRunningTests && !testsError && !tabResults && !showNoTestsCta && (
                <div className="text-sm text-neutral-500">Click "Run" to start.</div>
              )}
            </>
          )}

          {tab === 'coverage' && (
            <>
              {!isRunningCoverage && !coverageError && coverage && (
                <CoverageTable
                  data={coverage}
                  renderActions={(file, uncovered) => (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void onImproveCoverageClick(file, uncovered)}
                    >
                      <div className="flex flex-col items-center leading-none">
                        <IconDoubleUp className="w-4 h-4 mb-0.5" />
                        <span className="text-[10px]">Tests</span>
                      </div>
                    </Button>
                  )}
                />
              )}
              {!isRunningCoverage && !coverageError && !coverage && (
                <div className="text-sm text-neutral-500">Click "Run" to start.</div>
              )}
            </>
          )}

          {tab === 'custom' && (
            <div className="flex flex-col gap-3">
              <TestCustomConfigInput
                value={customConfigPath}
                onChange={setCustomConfigPath}
                candidates={configCandidates}
                envValues={customEnvValues}
                onEnvChange={setCustomEnvValues}
                disabled={isRunningCustomTests}
                helperText="Provide the path to a custom test config (e.g. Playwright, Cypress, or a vitest.e2e.config.ts). Chips below are detected in your project."
              />
              {!isRunningCustomTests && !testsErrorCustom && resultsCustom && (
                <TestResultsList results={resultsCustom} readFile={readFileForSnippets} />
              )}
              {!isRunningCustomTests && !testsErrorCustom && !resultsCustom && (
                <div className="text-sm text-neutral-500">Click "Run" to start.</div>
              )}
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
  const { projectId } = useActiveProject()
  return (
    <TestsProvider key={projectId}>
      <TestsInner />
    </TestsProvider>
  )
}
