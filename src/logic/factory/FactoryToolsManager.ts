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
  ToolCallContext,
} from 'thefactory-tools'
import DatabaseManager from '../db/DatabaseManager'
import GitManager from '../git/GitManager'
import GitCredentialsManager from '../git/GitCredentialsManager'
import StoriesManager from '../stories/StoriesManager'

export default class FactoryToolsManager extends BaseManager {
  private projectsManager: ProjectsManager
  private storiesManager: StoriesManager
  private settingsManager: SettingsManager
  private databaseManager: DatabaseManager
  private gitManager: GitManager
  private gitCredentialsManager: GitCredentialsManager
  private agentToolsMap: Record<string, AgentTools> = {}

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    projectsManager: ProjectsManager,
    storiesManager: StoriesManager,
    settingsManager: SettingsManager,
    databaseManager: DatabaseManager,
    gitManager: GitManager,
    credentialsManager: GitCredentialsManager,
  ) {
    super(projectRoot, window)
    this.projectsManager = projectsManager
    this.storiesManager = storiesManager
    this.settingsManager = settingsManager
    this.databaseManager = databaseManager
    this.gitManager = gitManager
    this.gitCredentialsManager = credentialsManager
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
    const git = await this.gitManager.getTools(projectId)
    const context: ToolCallContext = {
      git,
    }
    try {
      return await tools?.callTool(toolName, args, context)
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
    const githubCredentialsId = project.metadata?.githubCredentialsId
    const githubCredentials = this.gitCredentialsManager.get(githubCredentialsId)
    // const gitCredentials : GithubCredentials = { name: '', username: '', email: '', token: ''} //TODO:

    const appSettings = this.settingsManager.getAppSettings()
    const webSearchApiKeys = appSettings?.webSearchApiKeys
    const connectionString = this.databaseManager.getConnectionString()
    const storyTools = await this.storiesManager.getTools(projectId)

    const tools = await createTools(
      projectId,
      projectRoot,
      storyTools,
      webSearchApiKeys,
      connectionString,
      project.repo_url,
      githubCredentials,
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
