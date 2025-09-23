import type { TestResult, CoverageResult } from 'thefactory-tools'

export type LastTestResult = { result: TestResult; at: number; invalidated: boolean }
export type LastCoverageResult = { result: CoverageResult; at: number; invalidated: boolean }

export type FactoryTestsService = {
  runTests: (projectId: string, path?: string) => Promise<TestResult>
  runCoverage: (projectId: string, path?: string) => Promise<CoverageResult>
  getLastResult: (projectId: string) => Promise<LastTestResult | undefined>
  getLastCoverage: (projectId: string) => Promise<LastCoverageResult | undefined>
}

export const factoryTestsService: FactoryTestsService = { ...window.factoryTestsService }
