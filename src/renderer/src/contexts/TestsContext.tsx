import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useActiveProject } from './ProjectContext'
import { factoryTestsService } from '../services/factoryTestsService'
import type { CoverageResult, TestsResult } from 'thefactory-tools'

export type TestsCatalogItem = { value: string; label: string }

export type TestsContextValue = {
  isRunningTests: boolean
  isRunningCoverage: boolean
  isRunningCustomTests: boolean

  results?: TestsResult
  resultsCustom?: TestsResult
  coverage?: CoverageResult

  testsError: string | null
  testsErrorCustom: string | null
  coverageError: string | null

  isLoadingCatalog: boolean
  testsCatalog: TestsCatalogItem[]
  refreshTestsCatalog: () => Promise<void>

  runAllTests: () => Promise<void>
  runTestsCustom: (configPath?: string, env?: Record<string, string>) => Promise<void>
  runAllCoverages: () => Promise<void>
  resetTests: () => void
  resetTestsCustom: () => void
  resetCoverage: () => void
}

const TestsContext = createContext<TestsContextValue | null>(null)

export function TestsProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useActiveProject()

  const [isRunningTests, setIsRunningTests] = useState(false)
  const [isRunningCustomTests, setIsRunningCustomTests] = useState(false)
  const [isRunningCoverage, setIsRunningCoverage] = useState(false)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)

  const [results, setResults] = useState<TestsResult | undefined>(undefined)
  const [resultsCustom, setResultsCustom] = useState<TestsResult | undefined>(undefined)
  const [coverage, setCoverage] = useState<CoverageResult | undefined>(undefined)

  const [testsError, setTestsError] = useState<string | null>(null)
  const [testsErrorCustom, setTestsErrorCustom] = useState<string | null>(null)
  const [coverageError, setCoverageError] = useState<string | null>(null)

  const [testsCatalog, setTestsCatalog] = useState<TestsCatalogItem[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!projectId) return
      // Each cached endpoint is independent — a single failure shouldn't
      // wipe out the others (matches the web parity).
      const [lastRes, lastCov, lastCustomRes] = await Promise.allSettled([
        factoryTestsService.getLastResult(projectId),
        factoryTestsService.getLastCoverage(projectId),
        factoryTestsService.getLastResultCustom(projectId),
      ])
      if (cancelled) return
      if (lastRes.status === 'fulfilled') setResults(lastRes.value)
      if (lastCov.status === 'fulfilled') setCoverage(lastCov.value)
      if (lastCustomRes.status === 'fulfilled') setResultsCustom(lastCustomRes.value)
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

  const resetTestsCustom = useCallback(() => {
    setResultsCustom(undefined)
    setTestsErrorCustom(null)
  }, [])

  const resetCoverage = useCallback(() => {
    setCoverage(undefined)
    setCoverageError(null)
  }, [])

  const runAllTests = useCallback(async () => {
    if (!projectId) return
    setIsRunningTests(true)
    setTestsError(null)
    setResults(undefined)
    try {
      const res = await factoryTestsService.runAllTests(projectId)
      setResults(res)
    } catch (e: any) {
      setTestsError(e?.message || String(e))
    } finally {
      setIsRunningTests(false)
    }
  }, [projectId])

  const runTestsCustom = useCallback(
    async (configPath?: string, env?: Record<string, string>) => {
      if (!projectId) return
      setIsRunningCustomTests(true)
      setTestsErrorCustom(null)
      setResultsCustom(undefined)
      try {
        const res = await factoryTestsService.runTestsCustom(projectId, configPath, env)
        setResultsCustom(res)
      } catch (e: any) {
        setTestsErrorCustom(e?.message || String(e))
      } finally {
        setIsRunningCustomTests(false)
      }
    },
    [projectId],
  )

  const runAllCoverages = useCallback(async () => {
    if (!projectId) return
    setIsRunningCoverage(true)
    setCoverageError(null)
    setCoverage(undefined)
    try {
      const res = await factoryTestsService.runAllCoverages(projectId)
      setCoverage(res)
    } catch (e: any) {
      setCoverageError(e?.message || String(e))
    } finally {
      setIsRunningCoverage(false)
    }
  }, [projectId])

  const value = useMemo<TestsContextValue>(
    () => ({
      isRunningTests,
      isRunningCoverage,
      isRunningCustomTests,
      isLoadingCatalog,
      results,
      resultsCustom,
      coverage,
      testsError,
      testsErrorCustom,
      coverageError,
      testsCatalog,
      refreshTestsCatalog,
      runAllTests,
      runTestsCustom,
      runAllCoverages,
      resetTests,
      resetTestsCustom,
      resetCoverage,
    }),
    [
      isRunningTests,
      isRunningCoverage,
      isRunningCustomTests,
      isLoadingCatalog,
      results,
      resultsCustom,
      coverage,
      testsError,
      testsErrorCustom,
      coverageError,
      testsCatalog,
      refreshTestsCatalog,
      runAllTests,
      runTestsCustom,
      runAllCoverages,
      resetTests,
      resetTestsCustom,
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
