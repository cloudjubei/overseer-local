import { ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { createOrchestrator, createAgentRunStore, createPricingManager } from 'thefactory-tools'

export class FactoryToolsManager {
  constructor(projectRoot, window, dbManager) {
    this.projectRoot = projectRoot
    this.window = window
    this._ipcBound = false

    this.runHandles = new Map()
    this.pricingManager = null
    this.runStore = null
    this.orchestrator = null

    this.dbManager = dbManager
  }

  async init() {
    console.log('[factory] Creating pricingManager')
    this.pricingManager = createPricingManager({ projectRoot: this.projectRoot })

    const dbPath = path.join(this.projectRoot, '.factory')
    console.log('[factory] Initializing history store at', dbPath)
    this.runStore = createAgentRunStore({ dbPath })

    console.log('[factory] Creating orchestrator')
    const orchestratorOptions = {
      projectRoot: this.projectRoot,
      runStore: this.runStore,
      pricing: this.pricingManager,
    }

    this.orchestrator = createOrchestrator(orchestratorOptions)
    console.log('[factory] Orchestrator ready')

    this._registerIpcHandlers()

    console.log(
      '[factory] Pricing manager initialized. Loaded',
      this.pricingManager?.listPrices()?.prices?.length || 0,
      'prices.',
    )
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return

    const handlers = {}
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
      ipcMain.handle(handler, async (event, args) => {
        try {
          return await handlers[handler](args)
        } catch (e) {
          console.error(`${handler} failed`, e)
          return { ok: false, error: String(e?.message || e) }
        }
      })
    }

    this._ipcBound = true
  }

  startTaskRun(
    agentType,
    projectId,
    taskId,
    llmConfig,
    githubCredentials,
    webSearchApiKeys,
    dbConnectionString,
  ) {
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
      const { runHistory, runHandle } = this.orchestrator.startRun({
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
    } catch (err) {
      console.error('[factory] Failed to start task run', err?.stack || String(err))
      throw err
    }
  }

  startFeatureRun(
    agentType,
    projectId,
    taskId,
    featureId,
    llmConfig,
    githubCredentials,
    webSearchApiKeys,
  ) {
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
      const { runHistory, runHandle } = this.orchestrator.startRun({
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
    } catch (err) {
      console.error('[factory] Failed to start feature run', err?.stack || String(err))
      throw err
    }
  }

  async cancelRun(runId, reason) {
    console.log('[factory] CANCEL_RUN', { runId, reason })
    const run = this.runHandles.get(runId)
    if (run) {
      try {
        run.cancel(reason)
      } catch (err) {
        console.warn('[factory] Error cancelling run', runId, err?.message || err)
      }
    } else {
      console.warn('[factory] Cancel requested for unknown run', runId)
    }
  }

  async listActiveRuns() {
    let out = []
    const runs = await this.orchestrator.listActiveRuns()
    for (const { runHistory, runHandle } of runs) {
      this._attachRunHandle(runHandle)
      out.push(runHistory)
    }
    return out
  }

  async getHistoryRuns() {
    return (await this.runStore.listRuns()) ?? []
  }
  async deleteHistoryRun(runId) {
    return await this.runStore.deleteRun(runId)
  }
  async rateRun(runId, rating) {
    return await this.runStore.rateRun(runId, rating)
  }

  async listPrices() {
    return await this.pricingManager.listPrices()
  }
  async refreshPrices(provider, url) {
    return await this.pricingManager.refresh(provider, url)
  }

  _nowIso() {
    return new Date().toISOString()
  }

  _attachRunHandle(runHandle) {
    if (this.runHandles.get(runHandle.id)) {
      return
    }

    console.log('[factory] Attaching run', runHandle.id)
    this.runHandles.set(runHandle.id, runHandle)

    runHandle.onEvent((e) => {
      console.log('[factory] Event: ', e.type)
      if (e) {
        if (e.type === 'run/cancelled' || e.type === 'run/completed' || e.type === 'run/error') {
          console.log('[factory] Cleaning up run', runHandle.id)
          this.runHandles.delete(runHandle.id)
        } else if (e.type === 'run/update' && e.payload) {
          const runId = e.id
          const run = e.payload
          this._emitUpdate(run)
        }
      }
    })
  }

  _maskSecrets(obj) {
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

  _emitUpdate(updated) {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send(IPC_HANDLER_KEYS.FACTORY_RUNS_SUBSCRIBE, updated)
    } catch (e) {
      console.warn('Failed to emit FACTORY_RUNS_SUBSCRIBE:', e)
    }
  }
}
