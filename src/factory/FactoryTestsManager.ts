import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import BaseManager from '../BaseManager'
import {
  createTestTools,
  TestTools,
  TestResult,
  CoverageResult,
  FileMeta,
  TestsResult,
} from 'thefactory-tools'
import ProjectsManager from '../projects/ProjectsManager'

export default class FactoryTestsManager extends BaseManager {
  private tools: Record<string, TestTools>
  private projectsManager: ProjectsManager

  constructor(projectRoot: string, window: BrowserWindow, projectsManager: ProjectsManager) {
    super(projectRoot, window)

    this.projectsManager = projectsManager

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
    return await tools?.runTest(path)
  }
  async runTests(projectId: string, path: string = '.'): Promise<TestsResult | undefined> {
    const tools = await this.__getTools(projectId)
    return await tools?.runTests(path)
  }

  async runTestCoverage(projectId: string, path: string): Promise<CoverageResult | undefined> {
    const tools = await this.__getTools(projectId)
    return await tools?.runTestCoverage(path)
  }
  async runTestsCoverage(
    projectId: string,
    path: string = '.',
  ): Promise<CoverageResult | undefined> {
    const tools = await this.__getTools(projectId)
    return await tools?.runTestsCoverage(path)
  }

  async getLastResult(projectId: string) {
    return undefined
  }

  async getLastCoverage(projectId: string) {
    return undefined
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
