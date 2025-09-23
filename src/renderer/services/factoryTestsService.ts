import type { LastCoverageResult, LastTestResult } from '../../factory/FactoryTestsManager'
import type { TestResult, CoverageResult, TestUpdate } from 'thefactory-tools'

export type FactoryTestsService = {
  subscribe: (callback: TestUpdate) => () => void
  listTests: (projectId: string) => Promise<string[]>
  runTest: (projectId: string, path: string) => Promise<TestResult>
  runTests: (projectId: string, path?: string) => Promise<TestResult[]>
  runCoverage: (projectId: string, path: string) => Promise<CoverageResult>
  runCoverages: (projectId: string, path?: string) => Promise<CoverageResult>
  getLastResult: (projectId: string) => Promise<LastTestResult | undefined>
  getLastCoverage: (projectId: string) => Promise<LastCoverageResult | undefined>
}

export const factoryTestsService: FactoryTestsService = { ...window.factoryTestsService }
