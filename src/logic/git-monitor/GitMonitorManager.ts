import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import gitHelper from './gitHelper'
import { analyzeBranchHeadForStory } from './CommitAnalyzer'
import { updateLocalStoryStateFromCommit } from './updateLocalStoryStateFromCommit'
import { isFeatureBranchName, branchNameToStoryId } from './storyBranchNaming'
import BaseManager from '../BaseManager'
import Mutex from '../utils/Mutex'
import type ProjectsManager from '../projects/ProjectsManager'
import { GitTools, createGitTools } from 'thefactory-tools'

/**
 * GitMonitorManager
 * - Periodically checks the project git repo for updates.
 * - Fetches remotes and lists branches with their latest commit SHAs and timestamps.
 * - Emits updates to renderer over IPC subscribe channel.
 * - Uses CommitAnalyzer to detect story.json in feature branches and updates local stories.
 *
 * Notes:
 * - Unlike the initial single-repo design, this manager now maintains per-project GitTools
 *   instances (one per projectId), similar to StoriesManager.
 * - It can be started per project via IPC, and on init we start a default 'main' instance
 *   so existing calls continue to work.
 */
export default class GitMonitorManager extends BaseManager {
  private _intervals: Record<string, any>
  private _pollMs: number
  private _lastSnapshot: any
  private _branchAnalysis: Map<string, string>

  private toolsLock = new Mutex()
  private tools: Record<string, GitTools> = {}
  private projectsManager?: ProjectsManager

  constructor(projectRoot: string, window: BrowserWindow, projectsManager?: ProjectsManager) {
    super(projectRoot, window)

    this.projectsManager = projectsManager

    this._intervals = {}
    this._pollMs = 30_000 // 30 seconds default
    this._lastSnapshot = null

    // Cache of last analyzed commit per branch to avoid repeated work
    this._branchAnalysis = new Map() // branchName -> commitSha
  }

  async init(): Promise<void> {
    // Ensure a default tools instance so legacy calls without projectId still work
    await this.__getTools('main')
    await super.init()
    // Kick off polling for the default project id
    await this.__startWatching('main')
  }

  async stopWatching(): Promise<void> {
    for (const key of Object.keys(this._intervals)) {
      if (this._intervals[key]) clearInterval(this._intervals[key])
      this._intervals[key] = null
    }
  }

  // Public IPC handlers
  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    // Status and controls (backward-compatible: if no projectId passed, uses 'main')
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GET_STATUS] = async (args: any = {}) =>
      await this.getStatus(args?.projectId || 'main')
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_TRIGGER_POLL] = async (args: any = {}) =>
      await this._tick(args?.projectId || 'main')
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_SET_POLL_INTERVAL] = async ({ ms }) =>
      await this.setPollInterval(ms)
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_HAS_UNMERGED] = async (args: any) =>
      await gitHelper.hasUnmergedCommits(
        await this.__getProjectRoot(args?.projectId),
        args?.branchName,
        args?.baseBranch,
      )
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_MERGE_BRANCH] = async (args: any) => {
      const result = await gitHelper.mergeBranchIntoBase(
        await this.__getProjectRoot(args?.projectId),
        args?.branchName,
        args?.baseBranch,
      )
      if (result?.ok) {
        await this._tick(args?.projectId || 'main')
      }
      return result
    }

    // New: explicit start controls mirroring document ingestion API shape
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_START_ALL] = async () => await this.startAllProjects()
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_START_PROJECT] = async ({ projectId }) =>
      await this.startProject(projectId)

    // New: GitTools-backed IPC methods
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_STATUS] = async ({ projectId }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.status()
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_LIST_REMOTES] = async ({ projectId }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.listRemotes()
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_FETCH] = async ({ projectId, remote }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.fetch(remote)
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_PULL] = async ({ projectId, remote, branch }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.pull(remote, branch)
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_PUSH] = async ({ projectId, remote, branch }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.push(remote, branch)
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_STAGE] = async ({ projectId, path }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.stage(path)
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_STAGE_ALL] = async ({ projectId }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.stageAll()
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_RESET] = async ({ projectId, path }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.reset(path)
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_DISCARD] = async ({ projectId, path }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.discard(path)
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_PUSH_ALL] = async ({ projectId, message }) => {
      const tools = await this.__getTools(projectId || 'main')
      await tools?.pushAll(message)
      return { ok: true }
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_CREATE_BRANCH] = async ({ projectId, name, checkoutAfter }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.createBranch(name, checkoutAfter)
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_CHECKOUT_BRANCH] = async ({ projectId, name, create }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.checkoutBranch(name, create)
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_DELETE_BRANCH] = async ({ projectId, name }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.deleteBranch(name)
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_RENAME_BRANCH] = async ({ projectId, oldName, newName }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.renameBranch(oldName, newName)
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_SET_UPSTREAM] = async ({ projectId, remote, branch }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.setUpstream(remote, branch)
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_LIST_BRANCHES] = async ({ projectId }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.listBranches()
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GIT_GET_CURRENT_BRANCH] = async ({ projectId }) => {
      const tools = await this.__getTools(projectId || 'main')
      return await tools?.getCurrentBranch()
    }

    return handlers
  }

  // Start monitoring all known projects
  async startAllProjects(): Promise<void> {
    const projects = await this.projectsManager?.listProjects?.()
    if (!projects) return
    await Promise.all(projects.map((p: any) => this.startProject(p.id)))
  }

  async startProject(projectId: string): Promise<void> {
    await this.__getTools(projectId)
    await this.__startWatching(projectId)
  }

  async setPollInterval(ms: number): Promise<void> {
    if (typeof ms === 'number' && ms >= 5_000 && ms <= 10 * 60_000) {
      this._pollMs = ms
      // restart all intervals with new cadence
      for (const projectId of Object.keys(this._intervals)) {
        await this.__startWatching(projectId)
      }
    }
  }

  async getStatus(projectId: string = 'main'): Promise<any> {
    const root = await this.__getProjectRoot(projectId)
    return await gitHelper.getStatus(root)
  }

  // Internal: per-project polling
  private async __startWatching(projectId: string): Promise<void> {
    // clear existing interval
    if (this._intervals[projectId]) clearInterval(this._intervals[projectId])
    await this._tick(projectId)
    this._intervals[projectId] = setInterval(() => {
      this._tick(projectId).catch((e) => console.warn('[git-monitor] tick failed', e?.message || e))
    }, this._pollMs)
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

  private async _analyzeFeatureBranches(_repoPath: string, branches: any[], projectId: string): Promise<void> {
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
        const analysis = await analyzeBranchHeadForStory(await this.__getProjectRoot(projectId), branchName)
        if (analysis?.ok && analysis?.found) {
          const storyId =
            branchNameToStoryId(branchName) || (analysis as any)?.extracted?.summary?.id || null

          const commitStoryData = (analysis as any).storyRaw || (analysis as any).extracted || null
          if (commitStoryData && storyId) {
            await updateLocalStoryStateFromCommit(await this.__getProjectRoot(projectId), commitStoryData, {
              storyId,
              gitMeta: {
                commit: analysis.commit,
                branch: branchName,
                storyJsonPath: (analysis as any).storyJsonPath || null,
              },
            })
          }
        }

        // Mark as analyzed for this commit regardless of found or not, to avoid rework
        this._branchAnalysis.set(branchName, headCommit)
      } catch (e: any) {
        console.warn('[git-monitor] analyze branch failed', branchName, e?.message || e)
      }
    }
  }

  private _emitUpdate(payload: any): void {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send(IPC_HANDLER_KEYS.GIT_MONITOR_SUBSCRIBE, payload)
    } catch (e: any) {
      console.warn('[git-monitor] emit failed', e?.message || e)
    }
  }

  // Tools management (per project)
  private async __getTools(projectId: string): Promise<GitTools | undefined> {
    await this.toolsLock.lock()
    if (!this.tools[projectId]) {
      await this.__updateTools(projectId)
    }
    this.toolsLock.unlock()
    return this.tools[projectId]
  }

  private async __updateTools(projectId: string): Promise<GitTools | undefined> {
    const projectRoot = await this.__getProjectRoot(projectId)
    if (!projectRoot) {
      return
    }
    // In the future, we may pass repoUrl/credentials; for now only path-based tools
    const tools = createGitTools(projectRoot)
    await tools.init()
    this.tools[projectId] = tools
    return tools
  }

  private async __getProjectRoot(projectId?: string): Promise<string> {
    if (!projectId || projectId === 'main') return this.projectRoot
    const dir = await this.projectsManager?.getProjectDir?.(projectId)
    return dir || this.projectRoot
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
