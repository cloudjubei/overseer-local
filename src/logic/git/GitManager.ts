import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import { GitTools, createGitTools } from 'thefactory-tools'
import ProjectsManager from '../projects/ProjectsManager'
import Mutex from '../utils/Mutex'
import BaseManager from '../BaseManager'
import CredentialsManager from './CredentialsManager'

export default class GitManager extends BaseManager {
  private toolsLock = new Mutex()
  private tools: Record<string, GitTools> = {}
  private projectsManager: ProjectsManager
  private credentialsManager: CredentialsManager

  constructor(projectRoot: string, window: BrowserWindow, projectsManager: ProjectsManager, credentialsManager: CredentialsManager) {
    super(projectRoot, window)

    this.projectsManager = projectsManager
    this.credentialsManager = credentialsManager
  }

  async init(): Promise<void> {
    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.GIT_TODO] = async ({ projectId }) => this.todo(projectId)

    return handlers
  }

  async todo(projectId: string) {
    const tools = await this.__getTools(projectId)
    return tools ? undefined : undefined
  }

  private async updateTool(projectId: string): Promise<GitTools | undefined> {
    const projectRoot = await this.projectsManager.getProjectDir(projectId)
    if (!projectRoot) {
      return
    }
    const project = await this.projectsManager.getProject(projectId)
    if (!project) {
      return
    }
    const repoUrl = project.repo_url

    const githubCredentials = this.credentialsManager.getDefault()
    if (!githubCredentials) {
      return
    }

    const tools = createGitTools(projectRoot, repoUrl, githubCredentials)
    await tools.init()
    this.tools[projectId] = tools

    // tools.subscribe(async (update) => {
    //   if (this.window) {
    //     this.window.webContents.send(IPC_HANDLER_KEYS.GIT_SUBSCRIBE, update)
    //   }
    // })
    return tools
  }
  private async __getTools(projectId: string): Promise<GitTools | undefined> {
    await this.toolsLock.lock()
    if (!this.tools[projectId]) {
      await this.updateTool(projectId)
    }
    this.toolsLock.unlock()
    return this.tools[projectId]
  }
}
