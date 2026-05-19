import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  abortTestsRun,
  getLastCoverage,
  getLastTestsCustomRun,
  getLastTestsRun,
  listTests,
  startCoverageAllRun,
  startCoverageRun,
  startTestsRun,
  startTestsRunAll,
  isCoverage,
  isTestRun,
} from 'thefactory-ui/headless/api'
import type {
  CoverageResult,
  TestsResult,
  CoverageInput,
  RunTestsInput,
  TestsProgressData,
} from 'thefactory-ui/headless/api'
import { useApi } from './ApiContext'
import { useActiveProject } from './ProjectsContext'

export type TestsRunKind = 'unit' | 'unit-all' | 'coverage' | 'coverage-all'

/**
 * Live state for the in-flight test run. `total` and `currentFile` may not
 * be set yet — the upstream `started` event only carries `total` for unit
 * runs, and `currentFile` is only known once a `file:start` arrives.
 */
export type TestsRunningJob = {
  jobId: string
  kind: TestsRunKind
  completed: number
  total?: number
  currentFile?: string
}

export type TestsContextValue = {
  isLoaded: boolean
  loadError: Error | null

  available: string[]
  lastRun: TestsResult | null
  /** Latest result from a custom-config run (separate cache on the backend). */
  lastCustomRun: TestsResult | null
  lastCoverage: CoverageResult | null

  runningJob: TestsRunningJob | null
  isRunning: boolean

  runTests: (input: RunTestsInput) => Promise<TestsResult>
  runAllTests: () => Promise<TestsResult>
  runCoverage: (input: CoverageInput) => Promise<CoverageResult>
  runCoverageAll: () => Promise<CoverageResult>
  abort: () => Promise<void>

  refresh: () => Promise<void>
}

const TestsContext = createContext<TestsContextValue | null>(null)

const EMPTY_AVAILABLE: string[] = []

type Deferred<T> = {
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

function isProgressData(v: unknown): v is TestsProgressData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Partial<TestsProgressData>
  return (
    typeof d.jobId === 'string' &&
    typeof d.projectId === 'string' &&
    typeof d.event === 'object' &&
    d.event !== null
  )
}

export function TestsProvider({ children }: { children: ReactNode }) {
  const { ws } = useApi()
  const { projectId } = useActiveProject()

  const [available, setAvailable] = useState<string[]>(EMPTY_AVAILABLE)
  const [lastRun, setLastRun] = useState<TestsResult | null>(null)
  const [lastCustomRun, setLastCustomRun] = useState<TestsResult | null>(null)
  const [lastCoverage, setLastCoverage] = useState<CoverageResult | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [runningJob, setRunningJob] = useState<TestsRunningJob | null>(null)

  // Pending result for the in-flight job. Resolved by the WS `finished`
  // event, rejected by `aborted` / `error`.
  const pendingRef = useRef<{
    jobId: string
    kind: TestsRunKind
    deferred: Deferred<TestsResult | CoverageResult>
  } | null>(null)

  // Track the latest active project id so an in-flight refresh that resolves
  // *after* the user has switched projects can detect itself as stale and
  // drop its setState calls — otherwise it would overwrite the new project's
  // (reset) state with the previous project's results.
  const latestProjectIdRef = useRef<string | undefined>(projectId)
  useEffect(() => {
    latestProjectIdRef.current = projectId
  }, [projectId])

  const refresh = useCallback(async () => {
    const requestedProjectId = projectId
    if (!requestedProjectId) {
      setAvailable(EMPTY_AVAILABLE)
      setLastRun(null)
      setLastCustomRun(null)
      setLastCoverage(null)
      setIsLoaded(true)
      setLoadError(null)
      return
    }
    const path = { projectId: requestedProjectId }
    const opts = { path, throwOnError: true } as const
    // Each endpoint is independent — `listTests` is the only one that's
    // load-bearing for rendering. The three `getLast*` calls return cached
    // results and can transiently 404 right after a project is checked out;
    // a single failure shouldn't blank the whole view.
    const [listRes, runRes, customRes, coverageRes] = await Promise.allSettled([
      listTests(opts),
      getLastTestsRun(opts),
      getLastTestsCustomRun(opts),
      getLastCoverage(opts),
    ])
    if (latestProjectIdRef.current !== requestedProjectId) return
    if (listRes.status === 'fulfilled') {
      setAvailable(listRes.value.data)
      setLoadError(null)
    } else {
      const err = listRes.reason
      setLoadError(err instanceof Error ? err : new Error(String(err)))
    }
    setLastRun(
      runRes.status === 'fulfilled' && isTestRun(runRes.value.data) ? runRes.value.data : null,
    )
    setLastCustomRun(
      customRes.status === 'fulfilled' && isTestRun(customRes.value.data)
        ? customRes.value.data
        : null,
    )
    setLastCoverage(
      coverageRes.status === 'fulfilled' && isCoverage(coverageRes.value.data)
        ? coverageRes.value.data
        : null,
    )
    setIsLoaded(true)
  }, [projectId])

  useEffect(() => {
    setIsLoaded(false)
    setAvailable(EMPTY_AVAILABLE)
    setLastRun(null)
    setLastCustomRun(null)
    setLastCoverage(null)
    setLoadError(null)
    // Clear any in-flight job state so a project switch doesn't leak the
    // previous project's running indicator or resolve a stale `pendingRef`
    // with the new project's events.
    setRunningJob(null)
    pendingRef.current = null
    void refresh()
  }, [projectId, refresh])

  // Other broadcasters (sync run endpoints, agent runs) still emit
  // `tests:result` — keep refreshing on those so external runs surface here.
  useEffect(() => ws.on('tests:result', () => void refresh()), [ws, refresh])

  // Streaming updates for the in-flight job we started ourselves.
  useEffect(
    () =>
      ws.on('tests:progress', (raw) => {
        if (!isProgressData(raw)) return
        const pending = pendingRef.current
        if (!pending || raw.jobId !== pending.jobId) return
        const event = raw.event

        switch (event.type) {
          case 'started':
            setRunningJob((cur) =>
              cur && cur.jobId === pending.jobId ? { ...cur, total: event.total } : cur,
            )
            break
          case 'file:start':
            setRunningJob((cur) =>
              cur && cur.jobId === pending.jobId
                ? {
                    ...cur,
                    currentFile: event.path,
                    total: event.total ?? cur.total,
                  }
                : cur,
            )
            break
          case 'file:end':
            // `event.index` is the file's slot position assigned at start, not
            // completion order — with parallel workers, files finish out of
            // order. Always increment so the bar advances monotonically.
            setRunningJob((cur) =>
              cur && cur.jobId === pending.jobId
                ? {
                    ...cur,
                    completed: cur.completed + 1,
                    total: event.total ?? cur.total,
                    currentFile: undefined,
                  }
                : cur,
            )
            break
          case 'finished':
            pending.deferred.resolve(event.result)
            pendingRef.current = null
            setRunningJob(null)
            break
          case 'aborted':
            pending.deferred.reject(new Error('Test run aborted'))
            pendingRef.current = null
            setRunningJob(null)
            break
          case 'error':
            pending.deferred.reject(new Error(event.error))
            pendingRef.current = null
            setRunningJob(null)
            break
        }
      }),
    [ws],
  )

  const runScoped = useCallback(
    async <R extends TestsResult | CoverageResult>(
      kind: TestsRunKind,
      start: (id: string) => Promise<{ jobId: string }>,
    ): Promise<R> => {
      if (!projectId) throw new Error('No active project — cannot run tests')
      if (pendingRef.current) throw new Error('A test run is already in progress')

      const { jobId } = await start(projectId)
      const deferred = (() => {
        let resolve!: Deferred<TestsResult | CoverageResult>['resolve']
        let reject!: Deferred<TestsResult | CoverageResult>['reject']
        const promise = new Promise<TestsResult | CoverageResult>((res, rej) => {
          resolve = res
          reject = rej
        })
        return { promise, resolve, reject }
      })()
      pendingRef.current = {
        jobId,
        kind,
        deferred: { resolve: deferred.resolve, reject: deferred.reject },
      }
      setRunningJob({ jobId, kind, completed: 0 })
      return deferred.promise as Promise<R>
    },
    [projectId],
  )

  const runTestsImpl = useCallback(
    async (input: RunTestsInput) => {
      const usedCustomConfig = Boolean(
        (input as RunTestsInput & { configPath?: string }).configPath?.trim(),
      )
      const result = await runScoped<TestsResult>('unit', async (id) => {
        const { data } = await startTestsRun({
          path: { projectId: id },
          body: input,
          throwOnError: true,
        })
        return { jobId: data.jobId }
      })
      // Runs invoked with a `configPath` land in the separate custom cache
      // so the regular Results tab stays anchored to the standard runner.
      if (usedCustomConfig) setLastCustomRun(result)
      else setLastRun(result)
      return result
    },
    [runScoped],
  )

  const runAllTestsImpl = useCallback(async () => {
    const result = await runScoped<TestsResult>('unit-all', async (id) => {
      const { data } = await startTestsRunAll({ path: { projectId: id }, throwOnError: true })
      return { jobId: data.jobId }
    })
    setLastRun(result)
    return result
  }, [runScoped])

  const runCoverageImpl = useCallback(
    async (input: CoverageInput) => {
      const result = await runScoped<CoverageResult>('coverage', async (id) => {
        const { data } = await startCoverageRun({
          path: { projectId: id },
          body: input,
          throwOnError: true,
        })
        return { jobId: data.jobId }
      })
      setLastCoverage(result)
      return result
    },
    [runScoped],
  )

  const runCoverageAllImpl = useCallback(async () => {
    const result = await runScoped<CoverageResult>('coverage-all', async (id) => {
      const { data } = await startCoverageAllRun({ path: { projectId: id }, throwOnError: true })
      return { jobId: data.jobId }
    })
    setLastCoverage(result)
    return result
  }, [runScoped])

  const abort = useCallback(async () => {
    const pending = pendingRef.current
    if (!pending) return
    await abortTestsRun({ body: { jobId: pending.jobId }, throwOnError: true })
    // The terminal `aborted` event will arrive on `tests:progress` and clean
    // up `pendingRef` / `runningJob` there. If the backend has already
    // finished the job, this call returns `{ aborted: false }` and we just
    // keep waiting for the (imminent) `finished` event.
  }, [])

  const value = useMemo<TestsContextValue>(
    () => ({
      isLoaded,
      loadError,
      available,
      lastRun,
      lastCustomRun,
      lastCoverage,
      runningJob,
      isRunning: runningJob !== null,
      runTests: runTestsImpl,
      runAllTests: runAllTestsImpl,
      runCoverage: runCoverageImpl,
      runCoverageAll: runCoverageAllImpl,
      abort,
      refresh,
    }),
    [
      isLoaded,
      loadError,
      available,
      lastRun,
      lastCustomRun,
      lastCoverage,
      runningJob,
      runTestsImpl,
      runAllTestsImpl,
      runCoverageImpl,
      runCoverageAllImpl,
      abort,
      refresh,
    ],
  )

  return <TestsContext.Provider value={value}>{children}</TestsContext.Provider>
}

export function useTests(): TestsContextValue {
  const ctx = useContext(TestsContext)
  if (!ctx) throw new Error('useTests must be used within TestsProvider')
  return ctx
}
