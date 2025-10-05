import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import BaseManager from '../BaseManager'
import Mutex from '../utils/Mutex'
import type ProjectsManager from '../projects/ProjectsManager'
import {
  GitOpResult,
  GitStatusPorcelain,
  GitTools,
  GithubCredentials,
  createGitTools,
} from 'thefactory-tools'

export default class GitMonitorManager extends BaseManager {
  private _intervals: Record<string, any>
  private _pollMs: number = 30_000 // 30 seconds default
  private _lastSnapshot: any = null
  private _branchAnalysis: Map<string, string>

  private toolsLock = new Mutex()
  private tools: Record<string, GitTools> = {}
  private projectsManager: ProjectsManager

  private credentials: Record<string, GithubCredentials> = {}

  constructor(projectRoot: string, window: BrowserWindow, projectsManager: ProjectsManager) {
    super(projectRoot, window)

    this.projectsManager = projectsManager

    this._intervals = {}

    // Cache of last analyzed commit per branch to avoid repeated work
    this._branchAnalysis = new Map() // branchName -> commitSha
  }

  async stopWatching(): Promise<void> {
    for (const key of Object.keys(this._intervals)) {
      if (this._intervals[key]) clearInterval(this._intervals[key])
      this._intervals[key] = null
    }
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.GIT_START_ALL] = async ({ credentialsMap }) =>
      await this.startAllProjects(credentialsMap)
    handlers[IPC_HANDLER_KEYS.GIT_START_PROJECT] = async ({ projectId, credentials }) =>
      await this.startProject(projectId, credentials)

    handlers[IPC_HANDLER_KEYS.GIT_GET_STATUS] = async ({ projectId }) =>
      await this.getStatus(projectId)
    handlers[IPC_HANDLER_KEYS.GIT_TRIGGER_POLL] = async ({ projectId }) =>
      await this._tick(projectId)
    handlers[IPC_HANDLER_KEYS.GIT_SET_POLL_INTERVAL] = async ({ ms }) =>
      await this.setPollInterval(ms)
    handlers[IPC_HANDLER_KEYS.GIT_HAS_UNMERGED] = async ({ projectId, branchName, baseBranch }) =>
      await this.hasUnmergedCommits(projectId, branchName, baseBranch)
    handlers[IPC_HANDLER_KEYS.GIT_MERGE_BRANCH] = async ({ projectId, branchName, baseBranch }) =>
      await this.mergeBranchIntoBase(projectId, branchName, baseBranch)

    //TODO: refactor below
    handlers[IPC_HANDLER_KEYS.GIT_LIST_REMOTES] = async ({ projectId }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.listRemotes()
    }
    handlers[IPC_HANDLER_KEYS.GIT_FETCH] = async ({ projectId, remote }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.fetch(remote)
    }
    handlers[IPC_HANDLER_KEYS.GIT_PULL] = async ({ projectId, remote, branch }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.pull(remote, branch)
    }
    handlers[IPC_HANDLER_KEYS.GIT_PUSH] = async ({ projectId, remote, branch }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.push(remote, branch)
    }
    handlers[IPC_HANDLER_KEYS.GIT_STAGE] = async ({ projectId, path }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.stage(path)
    }
    handlers[IPC_HANDLER_KEYS.GIT_STAGE_ALL] = async ({ projectId }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.stageAll()
    }
    handlers[IPC_HANDLER_KEYS.GIT_RESET] = async ({ projectId, path }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.reset(path)
    }
    handlers[IPC_HANDLER_KEYS.GIT_DISCARD] = async ({ projectId, path }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.discard(path)
    }
    handlers[IPC_HANDLER_KEYS.GIT_PUSH_ALL] = async ({ projectId, message }) => {
      const tools = await this.__getTools(projectId)
      await tools?.pushAll(message)
      return { ok: true }
    }
    handlers[IPC_HANDLER_KEYS.GIT_CREATE_BRANCH] = async ({ projectId, name, checkoutAfter }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.createBranch(name, checkoutAfter)
    }
    handlers[IPC_HANDLER_KEYS.GIT_CHECKOUT_BRANCH] = async ({ projectId, name, create }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.checkoutBranch(name, create)
    }
    handlers[IPC_HANDLER_KEYS.GIT_DELETE_BRANCH] = async ({ projectId, name }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.deleteBranch(name)
    }
    handlers[IPC_HANDLER_KEYS.GIT_RENAME_BRANCH] = async ({ projectId, oldName, newName }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.renameBranch(oldName, newName)
    }
    handlers[IPC_HANDLER_KEYS.GIT_SET_UPSTREAM] = async ({ projectId, remote, branch }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.setUpstream(remote, branch)
    }
    handlers[IPC_HANDLER_KEYS.GIT_LIST_BRANCHES] = async ({ projectId }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.listBranches()
    }
    handlers[IPC_HANDLER_KEYS.GIT_GET_CURRENT_BRANCH] = async ({ projectId }) => {
      const tools = await this.__getTools(projectId)
      return await tools?.getCurrentBranch()
    }

    return handlers
  }

  async startAllProjects(credentialsMap: Record<string, GithubCredentials>): Promise<void> {
    const projects = await this.projectsManager.listProjects()
    const credentials = { ...this.credentials, ...credentialsMap }

    await Promise.all(projects.map((p) => this.startProject(p.id, credentials[p.id])))
  }

  async startProject(projectId: string, credentials?: GithubCredentials): Promise<void> {
    if (!credentials) return
    this.credentials[projectId] = credentials
    await this.__getTools(projectId)
    await this.__startWatching(projectId)
  }

  async setPollInterval(ms: number): Promise<void> {
    if (typeof ms === 'number' && ms >= 5_000 && ms <= 10 * 60_000) {
      this._pollMs = ms
      for (const projectId of Object.keys(this._intervals)) {
        await this.__startWatching(projectId)
      }
    }
  }

  async getStatus(projectId: string): Promise<
    | (GitOpResult & {
        status?: GitStatusPorcelain
      })
    | undefined
  > {
    const tools = await this.__getTools(projectId)
    return await tools?.status()
  }
  async hasUnmergedCommits(projectId: string, branchName?: string, baseBranch?: string) {
    const tools = await this.__getTools(projectId)
    return await tools?.hasUnmergedCommits(branchName, baseBranch)
  }
  async mergeBranchIntoBase(projectId: string, branchName?: string, baseBranch?: string) {
    const tools = await this.__getTools(projectId)
    return await tools?.mergeBranchIntoBase(branchName, baseBranch)
  }

  private async _tick(projectId: string): Promise<any> {
    try {
      const status = await this.getStatus(projectId)

      // Try to analyze feature branches for story.json updates
      if (status?.ok && status?.repoPath && Array.isArray(status?.branches)) {
        await this._analyzeFeatureBranches(status.repoPath, status.branches, projectId)
      }

      // Emit per projectId; snapshot kept globally for backward-compatibility
      if (JSON.stringify(status) !== JSON.stringify(this._lastSnapshot)) {
        this._lastSnapshot = status
        this._emitUpdate({ ...(status || {}), projectId })
      }
    } catch (e: any) {
      console.warn('[git-monitor] tick error', e?.message || e)
    }
    return this._lastSnapshot
  }

  private async _analyzeFeatureBranches(
    _repoPath: string,
    branches: any[],
    projectId: string,
  ): Promise<void> {
    // Filter feature branches only
    const featureBranches = branches.filter((b) => isFeatureBranchName(b?.name))

    for (const b of featureBranches) {
      const branchName = b.name
      const headCommit = b.sha

      if (!branchName || !headCommit) continue

      // Skip if we've already analyzed this commit for this branch
      const last = this._branchAnalysis.get(branchName)
      if (last && last === headCommit) continue

      try {
        const analysis = await analyzeBranchHeadForStory(
          await this.__getProjectRoot(projectId),
          branchName,
        )
        if (analysis?.ok && analysis?.found) {
          const storyId =
            branchNameToStoryId(branchName) || (analysis as any)?.extracted?.summary?.id || null

          const commitStoryData = (analysis as any).storyRaw || (analysis as any).extracted || null
          if (commitStoryData && storyId) {
            await updateLocalStoryStateFromCommit(
              await this.__getProjectRoot(projectId),
              commitStoryData,
              {
                storyId,
                gitMeta: {
                  commit: analysis.commit,
                  branch: branchName,
                  storyJsonPath: (analysis as any).storyJsonPath || null,
                },
              },
            )
          }
        }

        // Mark as analyzed for this commit regardless of found or not, to avoid rework
        this._branchAnalysis.set(branchName, headCommit)
      } catch (e: any) {
        console.warn('[git-monitor] analyze branch failed', branchName, e?.message || e)
      }
    }
  }

  private async __startWatching(projectId: string): Promise<void> {
    if (this._intervals[projectId]) clearInterval(this._intervals[projectId])
    await this._tick(projectId)
    this._intervals[projectId] = setInterval(() => {
      this._tick(projectId).catch((e) => console.warn('[git-monitor] tick failed', e?.message || e))
    }, this._pollMs)
  }

  private _emitUpdate(payload: any): void {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send(IPC_HANDLER_KEYS.GIT_SUBSCRIBE, payload)
    } catch (e: any) {
      console.warn('[git] emit failed', e?.message || e)
    }
  }

  private async __getTools(projectId: string): Promise<GitTools | undefined> {
    await this.toolsLock.lock()
    if (!this.tools[projectId]) {
      await this.__updateTools(projectId)
    }
    this.toolsLock.unlock()
    return this.tools[projectId]
  }

  private async __updateTools(projectId: string): Promise<GitTools | undefined> {
    const projectRoot = await this.projectsManager.getProjectDir(projectId)
    if (!projectRoot) {
      return
    }
    const project = await this.projectsManager.getProject(projectId)
    if (!project) {
      return
    }
    const credentials = this.credentials[projectId]
    if (!credentials) {
      return
    }

    const tools = createGitTools(projectRoot, project.repo_url, credentials)
    await tools.init()
    this.tools[projectId] = tools
    return tools
  }
}

// export type GitOpResult = {
//     ok: true;
//     stdout?: string;
// } | {
//     ok: false;
//     error: string;
//     stderr?: string;
//     stdout?: string;
//     code?: number;
// };
// export type GitStatusPorcelain = {
//     staged: string[];
//     unstaged: string[];
//     untracked: string[];
// };
// export type GitBranchInfo = {
//     name: string;
//     current?: boolean;
// };
// export type GitTools = {
//     init(): Promise<void>;
//     status(): Promise<GitOpResult & {
//         status?: GitStatusPorcelain;
//     }>;
//     listRemotes(): Promise<GitOpResult & {
//         remotes?: string[];
//     }>;
//     fetch(remote?: string): Promise<GitOpResult>;
//     pull(remote?: string, branch?: string): Promise<GitOpResult>;
//     push(remote?: string, branch?: string): Promise<GitOpResult>;
//     stage(path: string): Promise<GitOpResult>;
//     stageAll(): Promise<GitOpResult>;
//     reset(path: string): Promise<GitOpResult>;
//     discard(path: string): Promise<GitOpResult>;
//     pushAll(message: string): Promise<void>;
//     createBranch(name: string, checkoutAfter?: boolean): Promise<GitOpResult>;
//     checkoutBranch(name: string, create: boolean): Promise<GitOpResult>;
//     deleteBranch(name: string): Promise<GitOpResult>;
//     renameBranch(oldName: string, newName: string): Promise<GitOpResult>;
//     setUpstream(remote?: string, branch?: string): Promise<GitOpResult>;
//     listBranches(): Promise<GitOpResult & {
//         branches?: GitBranchInfo[];
//     }>;
//     getCurrentBranch(): Promise<GitOpResult & {
//         branch?: string;
//     }>;
// };
// export type GithubCredentials = {
//     name: string;
//     username: string;
//     email: string;
//     token: string;
// };
