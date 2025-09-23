export type TestRunResult = {
  ok: boolean
  raw: any
}

export type TestsService = {
  runTests: (options?: { path?: string }) => Promise<TestRunResult>
  runCoverage: (options?: { path?: string }) => Promise<TestRunResult>
}

export const testsService: TestsService = { ...(window as any).testsService }
