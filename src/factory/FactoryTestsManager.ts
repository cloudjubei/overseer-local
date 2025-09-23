import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import BaseManager from '../BaseManager'
import { createTestTools, TestTools, TestResult, CoverageResult, FileMeta } from 'thefactory-tools'
import ProjectsManager from '../projects/ProjectsManager'
import type FilesManager from '../files/FilesManager'

export type LastTestResult = {
  result: TestResult[]
  snapshot: FileSnapshot
  at: number
  invalidated: boolean
}
export type LastCoverageResult = {
  result: CoverageResult
  snapshot: FileSnapshot
  at: number
  invalidated: boolean
}

export default class FactoryTestsManager extends BaseManager {
  private tools: Record<string, TestTools>
  private projectsManager: ProjectsManager
  private filesManager: FilesManager

  private lastTestResults: Record<string, LastTestResult> = {}
  private lastCoverageResults: Record<string, LastCoverageResult> = {}

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    projectsManager: ProjectsManager,
    filesManager: FilesManager,
  ) {
    super(projectRoot, window)

    this.projectsManager = projectsManager
    this.filesManager = filesManager

    this.tools = {}
  }

  async init(): Promise<void> {
    await this.__getTools('main')

    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_LIST] = async ({ projectId }) =>
      this.listTests(projectId)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_TEST] = async ({ projectId, path }) =>
      this.runTest(projectId, path)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_TESTS] = async ({ projectId, path }) =>
      this.runTests(projectId, path)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_COVERAGE] = async ({ projectId, path }) =>
      this.runTestCoverage(projectId, path)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_COVERAGES] = async ({ projectId, path }) =>
      this.runTestsCoverage(projectId, path)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_GET_LAST_RESULT] = async ({ projectId }) =>
      this.getLastResult(projectId)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_GET_LAST_COVERAGE] = async ({ projectId }) =>
      this.getLastCoverage(projectId)

    return handlers
  }

  async listTests(projectId: string): Promise<FileMeta[]> {
    const tools = await this.__getTools(projectId)
    return (await tools?.listTests()) ?? []
  }

  async runTest(projectId: string, path: string): Promise<TestResult | undefined> {
    const tools = await this.__getTools(projectId)
    const res = await tools?.runTest(path)
    if (res) {
      //TODO: update
      // const snapshot = await this.buildProjectSnapshot(projectId)
      // this.lastTestResults[projectId] = {
      //   result: res,
      //   snapshot,
      //   at: Date.now(),
      //   invalidated: false,
      // }
    }
    return res
  }
  async runTests(projectId: string, path: string = '.'): Promise<TestResult[]> {
    const tools = await this.__getTools(projectId)
    const res = await tools?.runTests(path)
    if (res) {
      const snapshot = await this.buildProjectSnapshot(projectId)
      this.lastTestResults[projectId] = {
        result: res,
        snapshot,
        at: Date.now(),
        invalidated: false,
      }
    }
    return res ?? []
  }

  async runTestCoverage(projectId: string, path: string): Promise<CoverageResult | undefined> {
    const tools = await this.__getTools(projectId)
    const res = await tools?.runTestCoverage(path)
    if (res) {
      const snapshot = await this.buildProjectSnapshot(projectId)
      this.lastCoverageResults[projectId] = {
        result: res,
        snapshot,
        at: Date.now(),
        invalidated: false,
      }
    }
    return res
  }
  async runTestsCoverage(
    projectId: string,
    path: string = '.',
  ): Promise<CoverageResult | undefined> {
    const tools = await this.__getTools(projectId)
    const res = await tools?.runTestsCoverage(path)
    if (res) {
      const snapshot = await this.buildProjectSnapshot(projectId)
      this.lastCoverageResults[projectId] = {
        result: res,
        snapshot,
        at: Date.now(),
        invalidated: false,
      }
    }
    return res
  }

  async getLastResult(projectId: string) {
    const entry = this.lastTestResults[projectId]
    if (!entry) return undefined
    const snapshot = await this.buildProjectSnapshot(projectId)
    const invalidated = this.isSnapshotInvalidated(entry.snapshot, snapshot)
    return { result: entry.result, snapshot, at: entry.at, invalidated }
  }

  async getLastCoverage(projectId: string) {
    const entry = this.lastCoverageResults[projectId]
    if (!entry) return undefined
    const snapshot = await this.buildProjectSnapshot(projectId)
    const invalidated = this.isSnapshotInvalidated(entry.snapshot, snapshot)
    return { result: entry.result, snapshot, at: entry.at, invalidated }
  }

  private async buildProjectSnapshot(projectId: string): Promise<FileSnapshot> {
    const stats = (await this.filesManager.getAllFileStats(projectId)) ?? []
    const snap: FileSnapshot = {}
    for (const meta of stats as any[]) {
      const k = toSnapshotKey(meta)
      if (!k) continue
      snap[k] = toSnapshotVal(meta)
    }
    return snap
  }
  private isSnapshotInvalidated(prev: FileSnapshot, curr: FileSnapshot): boolean {
    const prevKeys = new Set(Object.keys(prev))
    const currKeys = new Set(Object.keys(curr))
    if (prevKeys.size !== currKeys.size) return true
    for (const k of prevKeys) {
      if (!currKeys.has(k)) return true
      if (prev[k] !== curr[k]) return true
    }
    return false
  }

  private async updateTool(projectId: string): Promise<TestTools | undefined> {
    const projectRoot = await this.projectsManager.getProjectDir(projectId)
    if (!projectRoot) {
      return
    }
    const tools = createTestTools(projectRoot)
    await tools.init()
    this.tools[projectId] = tools

    tools.subscribe(async (testUpdate) => {
      if (this.window) {
        this.window.webContents.send(IPC_HANDLER_KEYS.FACTORY_TESTS_SUBSCRIBE, testUpdate)
      }
    })
  }
  private async __getTools(projectId: string): Promise<TestTools | undefined> {
    if (!this.tools[projectId]) {
      await this.updateTool(projectId)
    }
    return this.tools[projectId]
  }
}

type FileSnapshot = Record<string, string>

function toSnapshotKey(meta: any): string | null {
  // Try several common keys for a relative path
  const key = meta?.relPath || meta?.path || meta?.file || meta?.name || null
  if (!key || typeof key !== 'string') return null
  return key
}
function toSnapshotVal(meta: any): string {
  // Build a signature using common timestamp/size-like fields
  const mtime =
    meta?.mtimeMs ?? meta?.mtime ?? meta?.modifiedMs ?? meta?.modified ?? meta?.updatedAt ?? 0
  const size = meta?.size ?? meta?.length ?? ''
  const hash = meta?.hash ?? ''
  return `${mtime}-${size}-${hash}`
}
