import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { createOrchestrator, createAgentRunStore, createPricingManager } from 'thefactory-tools'
import type { BaseManager } from '../managers'
import type { DatabaseManager } from '../db/DatabaseManager'

export class FactoryToolsManager implements BaseManager {
  private projectRoot: string
  private window: BrowserWindow
  private _ipcBound: boolean

  private runHandles: Map<string, any>
  private pricingManager: any | null
  private runStore: any | null
  private orchestrator: any | null

  private dbManager: DatabaseManager

  constructor(projectRoot: string, window: BrowserWindow, dbManager: DatabaseManager) {
    this.projectRoot = projectRoot
    this.window = window
    this._ipcBound = false

    this.runHandles = new Map()
    this.pricingManager = null
    this.runStore = null
    this.orchestrator = null

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

    this._registerIpcHandlers()

    console.log(
      '[factory] Pricing manager initialized. Loaded',
      this.pricingManager?.listPrices()?.prices?.length || 0,
      'prices.',
    )
  }

  private _registerIpcHandlers(): void {
    if (this._ipcBound) return

    const handlers: Record<string, (args: any) => Promise<any> | any> = {}
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_START_TASK] = async ({
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
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_START_FEATURE] = async ({
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
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_CANCEL] = async ({ runId, reason }) =>
      await this.cancelRun(runId, reason)
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_LIST_ACTIVE] = async () => await this.listActiveRuns()
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_LIST_HISTORY] = async () => await this.getHistoryRuns()
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_DELETE_HISTORY] = async ({ runId }) =>
      await this.deleteHistoryRun(runId)
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_RATE] = async ({ runId, rating }) =>
      await this.rateRun(runId, rating)
    handlers[IPC_HANDLER_KEYS.FACTORY_PRICING_LIST] = async () => await this.listPrices()
    handlers[IPC_HANDLER_KEYS.FACTORY_PRICING_REFRESH] = async ({ provider, url }) =>
      await this.refreshPrices(provider, url)

    for (const handler of Object.keys(handlers)) {
      ipcMain.handle(handler, async (_event, args) => {
        try {
          return await handlers[handler](args)
        } catch (e: any) {
          console.error(`${handler} failed`, e)
          return { ok: false, error: String(e?.message || e) }
        }
      })
    }

    this._ipcBound = true
  }

  startTaskRun(
    agentType: string,
    projectId: string,
    taskId: string,
    llmConfig: any,
    githubCredentials: any,
    webSearchApiKeys: any,
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
      const { runHistory, runHandle } = (this.orchestrator as any).startRun({
        agentType,
        projectId,
        taskId,
        llmConfig,
        githubCredentials,
        webSearchApiKeys,
        dbConnectionString,
      })
      console.log('[factory] Run started (task)', runHandle.id)
      this._attachRunHandle(runHandle)
      return runHistory
    } catch (err: any) {
      console.error('[factory] Failed to start task run', err?.stack || String(err))
      throw err
    }
  }

  startFeatureRun(
    agentType: string,
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
      const { runHistory, runHandle } = (this.orchestrator as any).startRun({
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

  async cancelRun(runId: string, reason?: string): Promise<void> {
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
    }
  }

  async listActiveRuns(): Promise<any[]> {
    let out: any[] = []
    const runs = await (this.orchestrator as any).listActiveRuns()
    for (const { runHistory, runHandle } of runs) {
      this._attachRunHandle(runHandle)
      out.push(runHistory)
    }
    return out
  }

  async getHistoryRuns(): Promise<any[]> {
    return (await (this.runStore as any).listRuns()) ?? []
  }
  async deleteHistoryRun(runId: string): Promise<any> {
    return await (this.runStore as any).deleteRun(runId)
  }
  async rateRun(runId: string, rating: number): Promise<any> {
    return await (this.runStore as any).rateRun(runId, rating)
  }

  async listPrices(): Promise<any> {
    return await (this.pricingManager as any).listPrices()
  }
  async refreshPrices(provider?: string, url?: string): Promise<any> {
    return await (this.pricingManager as any).refresh(provider, url)
  }

  private _attachRunHandle(runHandle: any): void {
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

  private _emitUpdate(updated: any): void {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send(IPC_HANDLER_KEYS.FACTORY_RUNS_SUBSCRIBE, updated)
    } catch (e: any) {
      console.warn('Failed to emit FACTORY_RUNS_SUBSCRIBE:', e)
    }
  }
}

export default FactoryToolsManager
