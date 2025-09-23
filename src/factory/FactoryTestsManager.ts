import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import BaseManager from '../BaseManager'
import { createTestTools, TestTools, TestResult, CoverageResult } from 'thefactory-tools'
import ProjectsManager from '../projects/ProjectsManager'
import type FilesManager from '../files/FilesManager'

// A lightweight snapshot of project files to detect invalidation
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

export default class FactoryTestsManager extends BaseManager {
  private tools: Record<string, TestTools>
  private projectsManager: ProjectsManager
  private filesManager: FilesManager

  private lastTestResults: Record<
    string,
    { result: TestResult; snapshot: FileSnapshot; at: number }
  > = {}
  private lastCoverageResults: Record<
    string,
    { result: CoverageResult; snapshot: FileSnapshot; at: number }
  > = {}

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

    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN] = async ({ projectId, path }) =>
      this.runTest(projectId, path)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_COVERAGE] = async ({ projectId, path }) =>
      this.runTestCoverage(projectId, path)

    // New: fetch last cached results
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_GET_LAST_RESULT] = async ({ projectId }) => {
      const entry = this.lastTestResults[projectId]
      if (!entry) return undefined
      const current = await this.buildProjectSnapshot(projectId)
      const invalidated = this.isSnapshotInvalidated(entry.snapshot, current)
      return { result: entry.result, at: entry.at, invalidated }
    }
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_GET_LAST_COVERAGE] = async ({ projectId }) => {
      const entry = this.lastCoverageResults[projectId]
      if (!entry) return undefined
      const current = await this.buildProjectSnapshot(projectId)
      const invalidated = this.isSnapshotInvalidated(entry.snapshot, current)
      return { result: entry.result, at: entry.at, invalidated }
    }

    return handlers
  }

  async listTests(projectId: string): Promise<any[]> {
    const tools = await this.__getTools(projectId)
    // listTests added in thefactory-tools; optional chaining for safety
    return (await tools?.listTests?.()) ?? []
  }

  async runTest(projectId: string, path?: string): Promise<TestResult | undefined> {
    const tools = await this.__getTools(projectId)
    const res = await tools?.runTest(path)
    if (res) {
      const snapshot = await this.buildProjectSnapshot(projectId)
      this.lastTestResults[projectId] = { result: res, snapshot, at: Date.now() }
    }
    return res
  }

  async runTestCoverage(projectId: string, path?: string): Promise<CoverageResult | undefined> {
    const tools = await this.__getTools(projectId)
    const res = await tools?.runTestCoverage(path)
    if (res) {
      const snapshot = await this.buildProjectSnapshot(projectId)
      this.lastCoverageResults[projectId] = { result: res, snapshot, at: Date.now() }
    }
    return res
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
    // Initialize if available (pattern similar to Stories)
    await (tools as any)?.init?.()
    this.tools[projectId] = tools

    // forward subscribe updates from test tools to renderer via IPC
    ;(tools as any)?.subscribe?.((update: any) => {
      if (this.window) {
        this.window.webContents.send(IPC_HANDLER_KEYS.FACTORY_TESTS_SUBSCRIBE, update)
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
