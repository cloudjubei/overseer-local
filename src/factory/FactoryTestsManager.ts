import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import BaseManager from '../BaseManager'
import { createTestTools, TestTools } from 'thefactory-tools'
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

    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN] = async ({ projectId, path }) =>
      this.runTest(projectId, path)
    handlers[IPC_HANDLER_KEYS.FACTORY_TESTS_RUN_COVERAGE] = async ({ projectId, path }) =>
      this.runTestCoverage(projectId, path)

    return handlers
  }

  async runTest(projectId: string, path: string): Promise<string | undefined> {
    const tools = await this.__getTools(projectId)
    return tools?.runTest(path)
  }

  async runTestCoverage(projectId: string, path: string): Promise<string | undefined> {
    const tools = await this.__getTools(projectId)
    return tools?.runTestCoverage(path)
  }

  private async updateTool(projectId: string): Promise<TestTools | undefined> {
    const projectRoot = await this.projectsManager.getProjectDir(projectId)
    if (!projectRoot) {
      return
    }
    const tools = createTestTools(projectRoot)
    // await tools.init()
    this.tools[projectId] = tools

    // tools.subscribe(async (storyUpdate) => {
    //   if (this.window) {
    //     this.window.webContents.send(IPC_HANDLER_KEYS.FACTORY_TESTS_SUBSCRIBE, storyUpdate)
    //   }
    // })
  }
  private async __getTools(projectId: string): Promise<TestTools | undefined> {
    if (!this.tools[projectId]) {
      await this.updateTool(projectId)
    }
    return this.tools[projectId]
  }
}
