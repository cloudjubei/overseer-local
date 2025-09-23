import type { TestResult, CoverageResult } from 'thefactory-tools'

export type FactoryTestsService = {
  runTests: (projectId: string, path?: string) => Promise<TestResult>
  runCoverage: (projectId: string, path?: string) => Promise<CoverageResult>
}

export const factoryTestsService: FactoryTestsService = { ...window.factoryTestsService }
