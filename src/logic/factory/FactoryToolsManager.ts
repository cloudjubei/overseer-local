import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import BaseManager from '../BaseManager'
import ProjectsManager from '../projects/ProjectsManager'
import SettingsManager from '../settings/SettingsManager'
import {
  AgentTools,
  createAgentTools,
  createTools,
  GithubCredentials,
  PreviewToolNotSupportedResult,
} from 'thefactory-tools'

export default class FactoryToolsManager extends BaseManager {
  private projectsManager: ProjectsManager
  private settingsManager: SettingsManager
  private agentToolsMap: Record<string, AgentTools> = {}

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
    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.FACTORY_TOOLS_EXECUTE] = ({ projectId, toolName, args }) =>
      this.executeTool(projectId, toolName, args)

    handlers[IPC_HANDLER_KEYS.FACTORY_TOOLS_PREVIEW] = ({ projectId, toolName, args }) =>
      this.previewTool(projectId, toolName, args)

    return handlers
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

  async previewTool(
    projectId: string,
    toolName: string,
    args: any,
  ): Promise<any | PreviewToolNotSupportedResult> {
    const tools = await this.__getTools(projectId)

    try {
      return await tools?.previewTool(toolName, args)
    } catch (error: any) {
      console.error(`Error previewing tool "${toolName}":`, error)
      throw new Error(`Failed to preview tool "${toolName}": ${error.message}`)
    }
  }

  private async updateTool(projectId: string): Promise<AgentTools | undefined> {
    const projectRoot = await this.projectsManager.getProjectDir(projectId)
    if (!projectRoot) {
      return
    }
    const project = await this.projectsManager.getProject(projectId)
    if (!project) {
      return
    }
    // const githubCredentialsId = project.metadata?.githubCredentialsId
    // const gitCredentials : GithubCredentials = { name: '', username: '', email: '', token: ''} //TODO:

    const appSettings = this.settingsManager.getAppSettings()
    const webSearchApiKeys = appSettings?.webSearchApiKeys
    const dbConnectionString = appSettings?.database?.connectionString

    const tools = await createTools(
      projectId,
      projectRoot,
      // project.repo_url,
      // gitCredentials,
      webSearchApiKeys,
      dbConnectionString,
    )
    const agentTools = createAgentTools(tools)

    this.agentToolsMap[projectId] = agentTools
    return agentTools
  }
  private async __getTools(projectId: string): Promise<AgentTools | undefined> {
    if (!this.agentToolsMap[projectId]) {
      await this.updateTool(projectId)
    }
    return this.agentToolsMap[projectId]
  }
}
