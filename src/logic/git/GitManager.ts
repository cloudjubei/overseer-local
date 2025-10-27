import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import { ApplyMergeOptions, GitTools, MergeResult, createGitTools } from 'thefactory-tools'
import ProjectsManager from '../projects/ProjectsManager'
import Mutex from '../utils/Mutex'
import BaseManager from '../BaseManager'
import GitCredentialsManager from './GitCredentialsManager'

export default class GitManager extends BaseManager {
  private toolsLock = new Mutex()
  private tools: Record<string, GitTools> = {}
  private projectsManager: ProjectsManager
  private gitCredentialsManager: GitCredentialsManager

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    projectsManager: ProjectsManager,
    credentialsManager: GitCredentialsManager,
  ) {
    super(projectRoot, window)

    this.projectsManager = projectsManager
    this.gitCredentialsManager = credentialsManager
  }

  async init(): Promise<void> {
    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.GIT_APPLY_MERGE] = ({ projectId, options }) =>
      this.applyMerge(projectId, options)

    return handlers
  }

  private async applyMerge(
    projectId: string,
    options: Omit<ApplyMergeOptions, 'repoPath'>,
  ): Promise<MergeResult | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    return tools.applyMerge(options)
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

    const githubCredentialsId = project.metadata?.githubCredentialsId
    if (!githubCredentialsId) {
      return
    }

    const githubCredentials = this.gitCredentialsManager.get(githubCredentialsId)
    if (!githubCredentials) {
      return
    }

    const tools = createGitTools(projectRoot, repoUrl, githubCredentials)
    await tools.init()
    this.tools[projectId] = tools

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
