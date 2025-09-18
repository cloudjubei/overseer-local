import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import {
  createOrchestrator,
  createAgentRunStore,
  createPricingManager,
  AgentRunStore,
  PricingManager,
  AgentRunRatingPatch,
  AgentRunHistory,
  WebSearchApiKeys,
  GithubCredentials,
  RunOrchestrator,
  AgentType,
  RunHandle,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'
import type DatabaseManager from '../db/DatabaseManager'
import { PricingState } from 'thefactory-tools/dist/pricing'

export default class FactoryToolsManager extends BaseManager {
  private runHandles: Map<string, RunHandle>
  private pricingManager?: PricingManager
  private runStore?: AgentRunStore
  private orchestrator?: RunOrchestrator

  private dbManager: DatabaseManager

  constructor(projectRoot: string, window: BrowserWindow, dbManager: DatabaseManager) {
    super(projectRoot, window)

    this.runHandles = new Map()
    this.pricingManager = undefined
    this.runStore = undefined
    this.orchestrator = undefined

    this.dbManager = dbManager
  }

  async init(): Promise<void> {
    console.log('[factory] Creating pricingManager')
    this.pricingManager = createPricingManager({ projectRoot: this.projectRoot })

    const dbPath = this.projectRoot + '/.factory'
    console.log('[factory] Initializing history store at', dbPath)
    this.runStore = createAgentRunStore({ dbPath })

    console.log('[factory] Creating orchestrator')
    const orchestratorOptions = {
      projectRoot: this.projectRoot,
      runStore: this.runStore,
      pricing: this.pricingManager,
    }

    this.orchestrator = createOrchestrator(orchestratorOptions as any)
    console.log('[factory] Orchestrator ready')

    console.log(
      '[factory] Pricing manager initialized. Loaded',
      this.pricingManager?.listPrices()?.prices?.length || 0,
      'prices.',
    )
    await super.init()
  }

  getHandlers(): Record<string, (args: any) => any> {
    const handlers: Record<string, (args: any) => any> = {}

    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_START_TASK] = ({
      agentType,
      projectId,
      taskId,
      llmConfig,
      githubCredentials,
      webSearchApiKeys,
    }) =>
      this.startTaskRun(
        agentType,
        projectId,
        taskId,
        llmConfig,
        githubCredentials,
        webSearchApiKeys,
      )
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_START_FEATURE] = ({
      agentType,
      projectId,
      taskId,
      featureId,
      llmConfig,
      githubCredentials,
      webSearchApiKeys,
    }) =>
      this.startFeatureRun(
        agentType,
        projectId,
        taskId,
        featureId,
        llmConfig,
        githubCredentials,
        webSearchApiKeys,
      )
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_CANCEL] = ({ runId, reason }) =>
      this.cancelRun(runId, reason)
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_LIST_ACTIVE] = () => this.listActiveRuns()
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_LIST_HISTORY] = () => this.getHistoryRuns()
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_DELETE_HISTORY] = ({ runId }) =>
      this.deleteHistoryRun(runId)
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_RATE] = ({ runId, rating }) =>
      this.rateRun(runId, rating)
    handlers[IPC_HANDLER_KEYS.FACTORY_PRICING_LIST] = () => this.listPrices()
    return handlers
  }
  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}
    handlers[IPC_HANDLER_KEYS.FACTORY_PRICING_REFRESH] = async ({ provider, url }) =>
      await this.refreshPrices(provider, url)

    return handlers
  }

  startTaskRun(
    agentType: AgentType,
    projectId: string,
    taskId: string,
    llmConfig: any,
    githubCredentials: GithubCredentials,
    webSearchApiKeys?: WebSearchApiKeys,
  ): any {
    console.log(
      '[factory] START_TASK',
      this._maskSecrets({
        agentType,
        projectId,
        taskId,
        llmConfig,
        githubCredentials,
        webSearchApiKeys,
      }),
    )
    try {
      const dbConnectionString = this.dbManager.getConnectionString()
      const { runHistory, runHandle } = this.orchestrator!.startRun({
        agentType,
        projectId,
        taskId,
        llmConfig,
        githubCredentials,
        webSearchApiKeys,
        dbConnectionString,
      })
      console.log('[factory] Run started (task)', runHandle.id)
      console.log('[factory] Run started (task) runHistory: ', runHistory)
      this._attachRunHandle(runHandle)
      return runHistory
    } catch (err: any) {
      console.error('[factory] Failed to start task run', err?.stack || String(err))
      throw err
    }
  }

  startFeatureRun(
    agentType: AgentType,
    projectId: string,
    taskId: string,
    featureId: string,
    llmConfig: any,
    githubCredentials: any,
    webSearchApiKeys: any,
  ): any {
    console.log(
      '[factory] START_FEATURE',
      this._maskSecrets({
        agentType,
        projectId,
        taskId,
        featureId,
        llmConfig,
        githubCredentials,
        webSearchApiKeys,
      }),
    )
    try {
      const dbConnectionString = this.dbManager.getConnectionString()
      const { runHistory, runHandle } = this.orchestrator!.startRun({
        agentType,
        projectId,
        taskId,
        featureId,
        llmConfig,
        githubCredentials,
        webSearchApiKeys,
        dbConnectionString,
      })
      console.log('[factory] Run started (feature)', runHandle.id)
      this._attachRunHandle(runHandle)
      return runHistory
    } catch (err: any) {
      console.error('[factory] Failed to start feature run', err?.stack || String(err))
      throw err
    }
  }

  cancelRun(runId: string, reason?: string) {
    console.log('[factory] CANCEL_RUN', { runId, reason })
    const run = this.runHandles.get(runId)
    if (run) {
      try {
        run.cancel(reason)
      } catch (err: any) {
        console.warn('[factory] Error cancelling run', runId, err?.message || err)
      }
    } else {
      console.warn('[factory] Cancel requested for unknown run', runId)
      this.deleteHistoryRun(runId)
    }
  }

  listActiveRuns(): AgentRunHistory[] {
    let out: AgentRunHistory[] = []
    const runs = this.orchestrator!.listActiveRuns()
    for (const { runHistory, runHandle } of runs) {
      this._attachRunHandle(runHandle)
      out.push(runHistory)
    }
    return out
  }

  getHistoryRuns(): AgentRunHistory[] {
    return this.runStore?.listRuns() ?? []
  }
  deleteHistoryRun(runId: string): AgentRunHistory | undefined {
    return this.runStore?.deleteRun(runId)
  }
  rateRun(runId: string, rating: AgentRunRatingPatch): AgentRunHistory | undefined {
    return this.runStore?.rateRun(runId, rating)
  }

  listPrices(): PricingState | undefined {
    return this.pricingManager?.listPrices()
  }
  async refreshPrices(provider?: string, url?: string): Promise<PricingState | undefined> {
    return this.pricingManager?.refresh(provider, url)
  }

  private _attachRunHandle(runHandle: RunHandle): void {
    if (this.runHandles.get(runHandle.id)) {
      return
    }

    console.log('[factory] Attaching run', runHandle.id)
    this.runHandles.set(runHandle.id, runHandle)

    runHandle.onEvent((e: any) => {
      console.log('[factory] Event: ', e.type)
      if (e) {
        if (e.type === 'run/cancelled' || e.type === 'run/completed' || e.type === 'run/error') {
          console.log('[factory] Cleaning up run', runHandle.id)
          this.runHandles.delete(runHandle.id)
        } else if (e.type === 'run/update' && e.payload) {
          const run = e.payload
          this._emitUpdate(run)
        }
      }
    })
  }

  private _maskSecrets(obj: any): any {
    try {
      const o = JSON.parse(JSON.stringify(obj))
      if (o && o.llmConfig && typeof o.llmConfig === 'object') {
        if ('apiKey' in o.llmConfig) o.llmConfig.apiKey = '***'
      }
      if (o && o.githubCredentials && typeof o.githubCredentials === 'object') {
        if ('token' in o.githubCredentials) o.githubCredentials.token = '***'
      }
      if (o && o.webSearchApiKeys && typeof o.webSearchApiKeys === 'object') {
        if ('exa' in o.webSearchApiKeys) o.webSearchApiKeys.exa = '***'
        if ('serpapi' in o.webSearchApiKeys) o.webSearchApiKeys.serpapi = '***'
        if ('tavily' in o.webSearchApiKeys) o.webSearchApiKeys.tavily = '***'
      }
      return o
    } catch {
      return obj
    }
  }

  private _emitUpdate(updated: AgentRunHistory): void {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send(IPC_HANDLER_KEYS.FACTORY_RUNS_SUBSCRIBE, updated)
    } catch (e: any) {
      console.warn('Failed to emit FACTORY_RUNS_SUBSCRIBE:', e)
    }
  }
}
