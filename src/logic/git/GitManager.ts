import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import {
  ApplyMergeOptions,
  BuildMergeReportOptions,
  DiffSummary,
  GitMonitor,
  GitMonitorConfig,
  GitTools,
  LocalStatus,
  MergePlan,
  MergePlanOptions,
  MergeReport,
  MergeResult,
  createGitTools,
} from 'thefactory-tools'
import ProjectsManager from '../projects/ProjectsManager'
import Mutex from '../utils/Mutex'
import BaseManager from '../BaseManager'
import GitCredentialsManager from './GitCredentialsManager'

export default class GitManager extends BaseManager {
  private toolsLock = new Mutex()
  private tools: Record<string, GitTools> = {}
  private monitors: Record<string, GitMonitor> = {}
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

  async cleanup(): Promise<void> {
    for (const projectId in this.monitors) {
      this.stopMonitor(projectId)
    }
    await super.cleanup()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.GIT_APPLY_MERGE] = ({ projectId, options }) =>
      this.applyMerge(projectId, options)
    handlers[IPC_HANDLER_KEYS.GIT_GET_MERGE_PLAN] = ({ projectId, options }) =>
      this.getMergePlan(projectId, options)
    handlers[IPC_HANDLER_KEYS.GIT_BUILD_MERGE_REPORT] = ({ projectId, planOrOptions, options }) =>
      this.buildMergeReport(projectId, planOrOptions, options)
    handlers[IPC_HANDLER_KEYS.GIT_GET_LOCAL_STATUS] = ({ projectId, options }) =>
      this.getLocalStatus(projectId, options)
    handlers[IPC_HANDLER_KEYS.GIT_GET_BRANCH_DIFF_SUMMARY] = ({ projectId, options }) =>
      this.getBranchDiffSummary(projectId, options)

    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_START] = ({ projectId, options }) =>
      this.startMonitor(projectId, options)
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_STOP] = ({ projectId }) => this.stopMonitor(projectId)

    return handlers
  }

  private async startMonitor(
    projectId: string,
    options: Omit<GitMonitorConfig, 'repoPath'>,
  ): Promise<void> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      console.error(`[GitManager] Could not get tools for project ${projectId} to start monitor.`)
      return
    }

    await this.stopMonitor(projectId)

    const monitor = tools.startMonitor({
      ...options,
      onUpdate: (state) => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send(IPC_HANDLER_KEYS.GIT_MONITOR_UPDATE, {
            projectId,
            state,
          })
        }
      },
      onError: (err) => {
        console.error(`[GitManager] Monitor error for project ${projectId}:`, err)
      },
    })

    this.monitors[projectId] = monitor
  }

  private async stopMonitor(projectId: string): Promise<void> {
    const monitor = this.monitors[projectId]
    if (monitor) {
      monitor.stop()
      delete this.monitors[projectId]
    }
  }

  private async getMergePlan(
    projectId: string,
    options: Omit<MergePlanOptions, 'repoPath'>,
  ): Promise<MergePlan | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) return
    return tools.getMergePlan(options)
  }

  private async buildMergeReport(
    projectId: string,
    planOrOptions: MergePlan | Omit<MergePlanOptions, 'repoPath'>,
    options?: BuildMergeReportOptions,
  ): Promise<MergeReport | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) return

    const isPlan = (obj: any): obj is MergePlan => !!obj && Array.isArray((obj as any).files)

    if (isPlan(planOrOptions)) {
      return tools.buildMergeReport(planOrOptions as MergePlan, options)
    }

    const plan = await tools.getMergePlan(planOrOptions as Omit<MergePlanOptions, 'repoPath'>)
    return tools.buildMergeReport(plan, options)
  }

  private async getLocalStatus(
    projectId: string,
    options?: Omit<{ repoPath: string } & Parameters<GitTools['getLocalStatus']>[0], 'repoPath'>,
  ): Promise<LocalStatus | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) return
    return tools.getLocalStatus(options)
  }

  private async getBranchDiffSummary(
    projectId: string,
    options: { baseRef: string; headRef: string; includePatch?: boolean },
  ): Promise<DiffSummary | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) return
    return tools.getBranchDiffSummary(options)
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
