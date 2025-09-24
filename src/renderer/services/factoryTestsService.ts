import type {
  TestResult,
  CoverageResult,
  TestUpdate,
  FileMeta,
  TestsResult,
} from 'thefactory-tools'

export type FactoryTestsService = {
  subscribe: (callback: TestUpdate) => () => void
  listTests: (projectId: string) => Promise<FileMeta[]>
  runTest: (projectId: string, path: string) => Promise<TestResult | undefined>
  runTests: (projectId: string, path?: string) => Promise<TestsResult | undefined>
  runCoverage: (projectId: string, path: string) => Promise<CoverageResult | undefined>
  runCoverages: (projectId: string, path?: string) => Promise<CoverageResult | undefined>
  getLastResult: (projectId: string) => Promise<TestsResult | undefined>
  getLastCoverage: (projectId: string) => Promise<CoverageResult | undefined>
}

export const factoryTestsService: FactoryTestsService = { ...window.factoryTestsService }
