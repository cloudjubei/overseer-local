import type { CoverageResult, TestUpdate, FileMeta, TestsResult } from 'thefactory-tools'

export type FactoryTestsService = {
  subscribe: (callback: TestUpdate) => () => void
  listTests: (projectId: string) => Promise<FileMeta[]>
  runTests: (projectId: string, paths: string[]) => Promise<TestsResult | undefined>
  runAllTests: (projectId: string) => Promise<TestsResult | undefined>
  runTestsE2E: (projectId: string, command?: string) => Promise<TestsResult | undefined>
  runCoverages: (projectId: string, paths: string[]) => Promise<CoverageResult | undefined>
  runAllCoverages: (projectId: string) => Promise<CoverageResult | undefined>
  getLastResult: (projectId: string) => Promise<TestsResult | undefined>
  getLastResultE2E: (projectId: string) => Promise<TestsResult | undefined>
  getLastCoverage: (projectId: string) => Promise<CoverageResult | undefined>
}

export const factoryTestsService: FactoryTestsService = { ...window.factoryTestsService }
