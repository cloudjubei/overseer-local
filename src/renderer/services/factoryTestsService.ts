export type FactoryTestsService = {
  runTests: (projectId: string, path: string) => Promise<string>
  runCoverage: (projectId: string, path: string) => Promise<string>
}

export const factoryTestsService: FactoryTestsService = { ...window.factoryTestsService }
