import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useActiveProject } from './ProjectContext'
import { factoryTestsService } from '../services/factoryTestsService'
import type { CoverageResult, FileMeta, TestResult, TestsResult } from 'thefactory-tools'

export type TestsCatalogItem = { value: string; label: string }

export type TestsContextValue = {
  isRunningTests: boolean
  isRunningCoverage: boolean
  isLoadingCatalog: boolean

  results?: TestsResult
  coverage?: CoverageResult

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
  runTests: (path?: string) => Promise<void>
  runCoverage: (path?: string) => Promise<void>
  resetTests: () => void
  resetCoverage: () => void
}

const TestsContext = createContext<TestsContextValue | null>(null)

export function TestsProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useActiveProject()

  const [isRunningTests, setIsRunningTests] = useState(false)
  const [isRunningCoverage, setIsRunningCoverage] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)

  const [results, setResults] = useState<TestsResult | undefined>(undefined)
  const [coverage, setCoverage] = useState<CoverageResult | undefined>(undefined)

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
        if (lastRes) {
          // const parsed = mapTestResultsAggregate(lastRes.result as any)
          // setResults(parsed)
          // setResultsInvalidated(!!lastRes.invalidated)
          // setResultsAt(lastRes.at || null)
        } else {
          setResults(undefined)
          setResultsInvalidated(null)
          setResultsAt(null)
        }
        if (lastCov) {
          // setCoverage(lastCov.result)
          // setCoverageInvalidated(!!lastCov.invalidated)
          // setCoverageAt(lastCov.at || null)
        } else {
          setCoverage(undefined)
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
      const list = await factoryTestsService.listTests(projectId)
      const items: TestsCatalogItem[] = []
      for (const t of list ?? []) {
        const label = t.name
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
    setResults(undefined)
    setTestsError(null)
    setResultsInvalidated(null)
    setResultsAt(null)
  }, [])

  const resetCoverage = useCallback(() => {
    setCoverage(undefined)
    setCoverageError(null)
    setCoverageInvalidated(null)
    setCoverageAt(null)
  }, [])

  const runTests = useCallback(
    async (path?: string) => {
      if (!projectId) return
      setIsRunningTests(true)
      setTestsError(null)
      setResults(undefined)
      try {
        const res = await factoryTestsService.runTests(projectId, path?.trim() || '.')
        setResults(res)
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
      setCoverage(undefined)
      try {
        const res = await factoryTestsService.runCoverages(projectId, path?.trim() || '.')
        setCoverage(res)
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
