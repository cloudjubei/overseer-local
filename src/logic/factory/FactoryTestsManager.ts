import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import {
  createTestTools,
  TestTools,
  TestResult,
  CoverageResult,
  FileMeta,
  TestsResult,
} from 'thefactory-tools'
import ProjectsManager from '../projects/ProjectsManager'
import Mutex from '../utils/Mutex'
import BaseManager from '../BaseManager'

export default class FactoryTestsManager extends BaseManager {
  private toolsLock = new Mutex()
  private tools: Record<string, TestTools> = {}
  private projectsManager: ProjectsManager

  constructor(projectRoot: string, window: BrowserWindow, projectsManager: ProjectsManager) {
    super(projectRoot, window)

    this.projectsManager = projectsManager
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
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_TESTS] = async ({ projectId }) =>
      this.runTests(projectId)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_TESTS_E2E] = async ({ projectId, command }) =>
      this.runTestsE2E(projectId, command)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_COVERAGE] = async ({ projectId, path }) =>
      this.runTestCoverage(projectId, path)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_COVERAGES] = async ({ projectId }) =>
      this.runTestsCoverage(projectId)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_GET_LAST_RESULT] = async ({ projectId }) =>
      this.getLastResult(projectId)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_GET_LAST_RESULT_E2E] = async ({ projectId }) =>
      this.getLastResultE2E(projectId)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_GET_LAST_COVERAGE] = async ({ projectId }) =>
      this.getLastCoverage(projectId)

    return handlers
  }

  async listTests(projectId: string): Promise<string[]> {
    const tools = await this.__getTools(projectId)
    return (await tools?.listTests()) ?? []
  }

  async runTest(projectId: string, path: string): Promise<TestResult | undefined> {
    const tools = await this.__getTools(projectId)
    return await tools?.runTest(path)
  }
  async runTests(projectId: string): Promise<TestsResult | undefined> {
    const tools = await this.__getTools(projectId)
    return await tools?.runTests()
  }
  async runTestsE2E(projectId: string, command?: string): Promise<TestsResult | undefined> {
    const tools = await this.__getTools(projectId)
    return await tools?.runE2ETests(command)
  }

  async runTestCoverage(projectId: string, path: string): Promise<CoverageResult | undefined> {
    const tools = await this.__getTools(projectId)
    return await tools?.runTestCoverage(path)
  }
  async runTestsCoverage(projectId: string): Promise<CoverageResult | undefined> {
    const tools = await this.__getTools(projectId)
    return await tools?.runTestsCoverage()
  }

  async getLastResult(projectId: string) {
    const tools = await this.__getTools(projectId)
    return await tools?.getLastTestsRun()
  }

  async getLastResultE2E(projectId: string) {
    const tools = await this.__getTools(projectId)
    return await tools?.getLastE2ETestsRun()
  }

  async getLastCoverage(projectId: string) {
    const tools = await this.__getTools(projectId)
    return await tools?.getLastTestsCoverage()
  }

  private async updateTool(projectId: string): Promise<TestTools | undefined> {
    const projectRoot = await this.projectsManager.getProjectDir(projectId)
    if (!projectRoot) {
      return
    }
    const tools = createTestTools(projectId, projectRoot)
    await tools.init()
    this.tools[projectId] = tools

    tools.subscribe(async (testUpdate) => {
      if (this.window) {
        this.window.webContents.send(IPC_HANDLER_KEYS.FACTORY_TESTS_SUBSCRIBE, testUpdate)
      }
    })
    return tools
  }
  private async __getTools(projectId: string): Promise<TestTools | undefined> {
    await this.toolsLock.lock()
    if (!this.tools[projectId]) {
      await this.updateTool(projectId)
    }
    this.toolsLock.unlock()
    return this.tools[projectId]
  }
}
