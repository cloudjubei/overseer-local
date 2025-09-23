import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { ChatTool, createToolManager, createTools, ToolManager } from 'thefactory-tools'
import BaseManager from '../BaseManager'
import ProjectsManager from 'src/projects/ProjectsManager'
import SettingsManager from 'src/settings/SettingsManager'

export default class FactoryToolsManager extends BaseManager {
  private projectsManager: ProjectsManager
  private settingsManager: SettingsManager
  private toolManagers: Record<string, ToolManager> = {}

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    projectsManager: ProjectsManager,
    settingsManager: SettingsManager,
  ) {
    super(projectRoot, window)
    this.projectsManager = projectsManager
    this.settingsManager = settingsManager
  }

  async init(): Promise<void> {
    await this.__getTools('main')
    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.FACTORY_TOOLS_LIST] = ({ projectId }) => this.listTools(projectId)
    handlers[IPC_HANDLER_KEYS.FACTORY_TOOLS_EXECUTE] = ({ projectId, toolName, args }) =>
      this.executeTool(projectId, toolName, args)

    return handlers
  }

  async listTools(projectId: string): Promise<ChatTool[]> {
    const tools = await this.__getTools(projectId)
    return (await tools?.getSchemas()) ?? []
  }

  async executeTool(projectId: string, toolName: string, args: any): Promise<any> {
    const tools = await this.__getTools(projectId)

    try {
      return await tools?.callTool(toolName, args)
    } catch (error: any) {
      console.error(`Error executing tool "${toolName}":`, error)
      throw new Error(`Failed to execute tool "${toolName}": ${error.message}`)
    }
  }

  private async updateTool(projectId: string): Promise<ToolManager | undefined> {
    const projectRoot = await this.projectsManager.getProjectDir(projectId)
    if (!projectRoot) {
      return
    }
    const appSettings = this.settingsManager.getAppSettings()
    const webSearchApiKeys = appSettings?.webSearchApiKeys
    const dbConnectionString = appSettings?.database?.connectionString

    const tools = createTools(projectId, projectRoot, webSearchApiKeys, dbConnectionString)
    const toolManager = createToolManager(tools)

    this.toolManagers[projectId] = toolManager
  }
  private async __getTools(projectId: string): Promise<ToolManager | undefined> {
    if (!this.toolManagers[projectId]) {
      await this.updateTool(projectId)
    }
    return this.toolManagers[projectId]
  }
}
