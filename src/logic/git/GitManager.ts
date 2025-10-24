import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import { GitTools, createGitTools } from 'thefactory-tools'
import ProjectsManager from '../projects/ProjectsManager'
import Mutex from '../utils/Mutex'
import BaseManager from '../BaseManager'
import CredentialsManager from './CredentialsManager'
import type {
  StoryResolver,
  WorkspaceReport,
  StoryFeatureChange,
  DiffSummary,
} from './gitTypes.copy'

// Minimal shapes returned to the renderer for pending branches
export type PendingBranchSummary = {
  projectId: string
  repoPath: string
  baseRef: string
  branch: string
  ahead: number
  behind: number
  storyId?: string
  featureId?: string
  totals?: { insertions: number; deletions: number; filesChanged: number }
}

export type ProjectGitSummary = {
  projectId: string
  repoPath?: string
  baseRef?: string
  pending: PendingBranchSummary[]
  error?: string
}

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

    // Be tolerant to undefined args from invoke
    handlers[IPC_HANDLER_KEYS.GIT_TODO] = async (args?: { projectId?: string }) =>
      this.todo(args?.projectId)

    return handlers
  }

  // Aggregates pending feature branches across all projects or a single project
  async todo(projectId?: string): Promise<{ projects: ProjectGitSummary[] }> {
    if (projectId) {
      const summary = await this.scanProject(projectId)
      return { projects: [summary] }
    }

    const projects = await this.projectsManager.listProjects()
    const results: ProjectGitSummary[] = []
    for (const project of projects) {
      // @ts-ignore thefactory-tools ProjectSpec is expected to have an 'id'
      const pid: string = (project as any).id ?? (project as any).project_id ?? ''
      if (!pid) continue
      const summary = await this.scanProject(pid)
      results.push(summary)
    }
    return { projects: results }
  }

  private async scanProject(projectId: string): Promise<ProjectGitSummary> {
    try {
      const tools = await this.__getTools(projectId)
      if (!tools) {
        return { projectId, pending: [], error: 'git-tools-unavailable' }
      }

      const repoPath = await this.projectsManager.getProjectDir(projectId)
      if (!repoPath) {
        return { projectId, pending: [], error: 'project-dir-not-found' }
      }

      const current = await tools.getCurrentBranch()
      const baseRef = current.ok && current.branch ? current.branch : 'main'

      const listed = await tools.listBranches()
      if (!listed.ok || !listed.branches) {
        return { projectId, repoPath, baseRef, pending: [], error: 'list-branches-failed' }
      }

      const allBranches = listed.branches.map((b) => b.name)
      // Filter feature branches
      const featureBranches = allBranches.filter((name) => this.isFeatureBranch(name))
      if (featureBranches.length === 0) {
        return { projectId, repoPath, baseRef, pending: [] }
      }

      // Build a workspace report with our StoryResolver to attach story ids per branch
      const workspace: WorkspaceReport = await tools.buildWorkspaceReport({
        repoPath,
        baseRef,
        branches: featureBranches,
        includePatch: false,
        includeMetrics: false,
        storyResolver: this.makeStoryResolver(),
      })

      const pending: PendingBranchSummary[] = []
      for (const br of workspace.branches) {
        const branchName = br.branch.name
        const { storyId, featureId } = this.extractStoryFromBranch(branchName)
        const ahead = br.branch.ahead
        const behind = br.branch.behind
        if (ahead > 0) {
          pending.push({
            projectId,
            repoPath,
            baseRef: workspace.baseRef,
            branch: branchName,
            ahead,
            behind,
            storyId: storyId ?? br.groups?.[0]?.storyId,
            featureId: featureId ?? br.groups?.[0]?.featureId,
            totals: br.totals,
          })
        }
      }

      return { projectId, repoPath, baseRef, pending }
    } catch (err: any) {
      return { projectId, pending: [], error: err?.message ?? String(err) }
    }
  }

  private makeStoryResolver(): StoryResolver {
    return async (args) => {
      const { headRef, diff } = args
      const meta = this.extractStoryFromBranch(headRef)
      if (!meta.storyId && !meta.featureId) {
        return []
      }
      return [this.buildStoryChange(meta.storyId, meta.featureId, diff)]
    }
  }

  private buildStoryChange(
    storyId: string | undefined,
    featureId: string | undefined,
    diff: DiffSummary,
  ): StoryFeatureChange {
    return {
      storyId,
      featureId,
      files: diff.files,
      summary: { insertions: diff.insertions, deletions: diff.deletions },
    }
  }

  private isFeatureBranch(name: string): boolean {
    // Accept features/<uuid> and optionally features/<uuid>.<featureId>
    return /^features\/[0-9a-fA-F-]{36}(\.[^\s\/]+)?$/.test(name)
  }

  private extractStoryFromBranch(
    name: string,
  ): { storyId?: string; featureId?: string } {
    const m = name.match(/^features\/([0-9a-fA-F-]{36})(?:\.([^\s\/]+))?$/)
    if (!m) return {}
    const [, storyId, featureId] = m
    return { storyId, featureId }
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
    // @ts-ignore repo url field name from thefactory-tools' ProjectSpec
    const repoUrl = (project as any).repo_url || (project as any).repoUrl

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
