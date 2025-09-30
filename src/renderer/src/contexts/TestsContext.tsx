import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useActiveProject } from './ProjectContext'
import { factoryTestsService } from '../services/factoryTestsService'
import type { CoverageResult, TestsResult } from 'thefactory-tools'

export type TestsCatalogItem = { value: string; label: string }

export type TestsContextValue = {
  isRunningTests: boolean
  isRunningCoverage: boolean
  isRunningE2ETests: boolean

  results?: TestsResult
  resultsE2E?: TestsResult
  coverage?: CoverageResult

  testsError: string | null
  testsErrorE2E: string | null
  coverageError: string | null

  isLoadingCatalog: boolean
  testsCatalog: TestsCatalogItem[]
  refreshTestsCatalog: () => Promise<void>

  runTests: (path?: string) => Promise<void>
  runTestsE2E: (path?: string, overrideCommand?: string) => Promise<void>
  runCoverage: (path?: string) => Promise<void>
  resetTests: () => void
  resetTestsE2E: () => void
  resetCoverage: () => void
}

const TestsContext = createContext<TestsContextValue | null>(null)

export function TestsProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useActiveProject()

  const [isRunningTests, setIsRunningTests] = useState(false)
  const [isRunningE2ETests, setIsRunningE2ETests] = useState(false)
  const [isRunningCoverage, setIsRunningCoverage] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)

  const [results, setResults] = useState<TestsResult | undefined>(undefined)
  const [resultsE2E, setResultsE2E] = useState<TestsResult | undefined>(undefined)
  const [coverage, setCoverage] = useState<CoverageResult | undefined>(undefined)

  const [testsError, setTestsError] = useState<string | null>(null)
  const [testsErrorE2E, setTestsErrorE2E] = useState<string | null>(null)
  const [coverageError, setCoverageError] = useState<string | null>(null)

  const [testsCatalog, setTestsCatalog] = useState<TestsCatalogItem[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!projectId) return
      try {
        const [lastRes, lastCov, lastE2ERes] = await Promise.all([
          factoryTestsService.getLastResult(projectId),
          factoryTestsService.getLastCoverage(projectId),
          factoryTestsService.getLastResultE2E(projectId),
        ])
        if (cancelled) return
        setResults(lastRes)
        setCoverage(lastCov)
        setResultsE2E(lastE2ERes)
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
  }, [])

  const resetTestsE2E = useCallback(() => {
    setResultsE2E(undefined)
    setTestsErrorE2E(null)
  }, [])

  const resetCoverage = useCallback(() => {
    setCoverage(undefined)
    setCoverageError(null)
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
      } catch (e: any) {
        setTestsError(e?.message || String(e))
      } finally {
        setIsRunningTests(false)
      }
    },
    [projectId],
  )

  const runTestsE2E = useCallback(
    async (path?: string, overrideCommand?: string) => {
      if (!projectId) return
      setIsRunningE2ETests(true)
      setTestsErrorE2E(null)
      setResultsE2E(undefined)
      try {
        const res = await factoryTestsService.runTestsE2E(
          projectId,
          path?.trim() || '.', 
          overrideCommand,
        )
        setResultsE2E(res)
      } catch (e: any) {
        setTestsErrorE2E(e?.message || String(e))
      } finally {
        setIsRunningE2ETests(false)
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
      isRunningE2ETests,
      isLoadingCatalog,
      results,
      resultsE2E,
      coverage,
      testsError,
      testsErrorE2E,
      coverageError,
      testsCatalog,
      refreshTestsCatalog,
      runTests,
      runTestsE2E,
      runCoverage,
      resetTests,
      resetTestsE2E,
      resetCoverage,
    }),
    [
      isRunningTests,
      isRunningCoverage,
      isRunningE2ETests,
      isLoadingCatalog,
      results,
      resultsE2E,
      coverage,
      testsError,
      testsErrorE2E,
      coverageError,
      testsCatalog,
      refreshTestsCatalog,
      runTests,
      runTestsE2E,
      runCoverage,
      resetTests,
      resetTestsE2E,
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
