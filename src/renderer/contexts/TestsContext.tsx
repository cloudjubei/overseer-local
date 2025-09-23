import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useActiveProject } from './ProjectContext'
import { factoryTestsService } from '../services/factoryTestsService'
import type { TestResult } from 'thefactory-tools'
import type { ParsedTestResults, ParsedFailure } from '../utils/testResults'
import { parseTestOutput } from '../utils/testResults'
import type { ParsedCoverage } from '../utils/coverage'
import { parseCoverageOutput } from '../utils/coverage'

export type TestsCatalogItem = { value: string; label: string }

export type TestsContextValue = {
  // loading flags
  isRunningTests: boolean
  isRunningCoverage: boolean
  isLoadingCatalog: boolean
  // last results
  results: ParsedTestResults | null
  coverage: ParsedCoverage | null
  // invalidation flags and timestamps
  resultsInvalidated: boolean | null
  coverageInvalidated: boolean | null
  resultsAt: number | null
  coverageAt: number | null
  // errors
  testsError: string | null
  coverageError: string | null
  // test list/catalog for UI selection
  testsCatalog: TestsCatalogItem[]
  refreshTestsCatalog: () => Promise<void>
  // actions
  runTests: (path?: string) => Promise<void>
  runCoverage: (path?: string) => Promise<void>
  resetTests: () => void
  resetCoverage: () => void
}

const TestsContext = createContext<TestsContextValue | null>(null)

function mapTestResultToParsed(res: TestResult): ParsedTestResults {
  const anyRes: any = res as any
  // Build raw text for fallback viewing
  const chunks: string[] = []
  if (typeof anyRes.stdout === 'string' && anyRes.stdout.length) chunks.push(anyRes.stdout)
  if (typeof anyRes.stderr === 'string' && anyRes.stderr.length) chunks.push(anyRes.stderr)
  const rawText = chunks.length
    ? chunks.join('\n')
    : (() => {
        try {
          return JSON.stringify(res, null, 2)
        } catch {
          return String(res)
        }
      })()

  // Determine ok status defensively
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

  const mapped: ParsedTestResults = {
    ok,
    rawText,
    failures,
    summary,
  }

  // If no explicit failures and raw text exists, run heuristic parser to try to improve details
  if (mapped.failures.length === 0 && typeof rawText === 'string' && rawText.length > 0) {
    const heuristic = parseTestOutput(rawText)
    // Prefer detailed failures from heuristic if it found any
    if (heuristic.failures.length > 0) {
      mapped.failures = heuristic.failures
      mapped.summary = mapped.summary || heuristic.summary
      mapped.ok = mapped.ok && heuristic.ok
    }
  }

  return mapped
}

function extractTestLabel(x: any): string | null {
  if (x == null) return null
  if (typeof x === 'string') return x
  const cand = x.relPath || x.path || x.file || x.name || x.id || x.title || null
  return typeof cand === 'string' ? cand : null
}

export function TestsProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useActiveProject()

  const [isRunningTests, setIsRunningTests] = useState(false)
  const [isRunningCoverage, setIsRunningCoverage] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)

  const [results, setResults] = useState<ParsedTestResults | null>(null)
  const [coverage, setCoverage] = useState<ParsedCoverage | null>(null)

  const [resultsInvalidated, setResultsInvalidated] = useState<boolean | null>(null)
  const [coverageInvalidated, setCoverageInvalidated] = useState<boolean | null>(null)
  const [resultsAt, setResultsAt] = useState<number | null>(null)
  const [coverageAt, setCoverageAt] = useState<number | null>(null)

  const [testsError, setTestsError] = useState<string | null>(null)
  const [coverageError, setCoverageError] = useState<string | null>(null)

  const [testsCatalog, setTestsCatalog] = useState<TestsCatalogItem[]>([])

  // Load last cached results/coverage on mount or project change
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!projectId) return
      try {
        const [lastRes, lastCov] = await Promise.all([
          factoryTestsService.getLastResult(projectId),
          factoryTestsService.getLastCoverage(projectId),
        ])
        if (cancelled) return
        if (lastRes && lastRes.result) {
          const parsed = mapTestResultToParsed(lastRes.result as any)
          setResults(parsed)
          setResultsInvalidated(!!lastRes.invalidated)
          setResultsAt(lastRes.at || null)
        } else {
          setResults(null)
          setResultsInvalidated(null)
          setResultsAt(null)
        }
        if (lastCov && lastCov.result) {
          const parsedCov = parseCoverageOutput(lastCov.result as any)
          setCoverage(parsedCov)
          setCoverageInvalidated(!!lastCov.invalidated)
          setCoverageAt(lastCov.at || null)
        } else {
          setCoverage(null)
          setCoverageInvalidated(null)
          setCoverageAt(null)
        }
      } catch (_) {
        // ignore preload errors on initial load
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  // Load/refresh available tests list
  const refreshTestsCatalog = useCallback(async () => {
    if (!projectId) return
    setIsLoadingCatalog(true)
    try {
      const list: any[] = await factoryTestsService.listTests(projectId)
      const items: TestsCatalogItem[] = []
      for (const t of list ?? []) {
        const label = extractTestLabel(t)
        if (!label) continue
        items.push({ value: label, label })
      }
      // Deduplicate by value
      const seen = new Set<string>()
      const deduped: TestsCatalogItem[] = []
      for (const it of items) {
        if (seen.has(it.value)) continue
        seen.add(it.value)
        deduped.push(it)
      }
      setTestsCatalog(deduped)
    } catch (_) {
      // ignore catalog errors; leave empty
      setTestsCatalog([])
    } finally {
      setIsLoadingCatalog(false)
    }
  }, [projectId])

  useEffect(() => {
    // refresh when project changes
    setTestsCatalog([])
    if (projectId) {
      refreshTestsCatalog()
    }
  }, [projectId, refreshTestsCatalog])

  const resetTests = useCallback(() => {
    setResults(null)
    setTestsError(null)
    setResultsInvalidated(null)
    setResultsAt(null)
  }, [])

  const resetCoverage = useCallback(() => {
    setCoverage(null)
    setCoverageError(null)
    setCoverageInvalidated(null)
    setCoverageAt(null)
  }, [])

  const runTests = useCallback(
    async (path?: string) => {
      if (!projectId) return
      setIsRunningTests(true)
      setTestsError(null)
      setResults(null)
      try {
        const res = await factoryTestsService.runTests(projectId, path?.trim() || undefined)
        const parsed = mapTestResultToParsed(res)
        setResults(parsed)
        setResultsInvalidated(false)
        setResultsAt(Date.now())
      } catch (e: any) {
        setTestsError(e?.message || String(e))
      } finally {
        setIsRunningTests(false)
      }
    },
    [projectId],
  )

  const runCoverage = useCallback(
    async (path?: string) => {
      if (!projectId) return
      setIsRunningCoverage(true)
      setCoverageError(null)
      setCoverage(null)
      try {
        const res = await factoryTestsService.runCoverage(projectId, path?.trim() || undefined)
        const parsed = parseCoverageOutput(res as any)
        setCoverage(parsed)
        setCoverageInvalidated(false)
        setCoverageAt(Date.now())
      } catch (e: any) {
        setCoverageError(e?.message || String(e))
      } finally {
        setIsRunningCoverage(false)
      }
    },
    [projectId],
  )

  const value = useMemo<TestsContextValue>(
    () => ({
      isRunningTests,
      isRunningCoverage,
      isLoadingCatalog,
      results,
      coverage,
      resultsInvalidated,
      coverageInvalidated,
      resultsAt,
      coverageAt,
      testsError,
      coverageError,
      testsCatalog,
      refreshTestsCatalog,
      runTests,
      runCoverage,
      resetTests,
      resetCoverage,
    }),
    [
      isRunningTests,
      isRunningCoverage,
      isLoadingCatalog,
      results,
      coverage,
      resultsInvalidated,
      coverageInvalidated,
      resultsAt,
      coverageAt,
      testsError,
      coverageError,
      testsCatalog,
      refreshTestsCatalog,
      runTests,
      runCoverage,
      resetTests,
      resetCoverage,
    ],
  )

  return <TestsContext.Provider value={value}>{children}</TestsContext.Provider>
}

export function useTests(): TestsContextValue {
  const ctx = useContext(TestsContext)
  if (!ctx) throw new Error('useTests must be used within TestsProvider')
  return ctx
}
