import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import {
  createOrchestrator,
  createPricingManager,
  PricingManager,
  AgentRunRatingPatch,
  AgentRunHistory,
  WebSearchApiKeys,
  GithubCredentials,
  RunOrchestrator,
  AgentType,
  LLMConfig,
  createAgentRunTools,
  AgentRunTools,
  AgentRun,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'
import type DatabaseManager from '../db/DatabaseManager'
import { PricingState } from 'thefactory-tools/dist/pricing'

export default class FactoryToolsManager extends BaseManager {
  private pricingManager?: PricingManager
  private agentRunTools?: AgentRunTools
  private orchestrator?: RunOrchestrator

  private dbManager: DatabaseManager

  constructor(projectRoot: string, window: BrowserWindow, dbManager: DatabaseManager) {
    super(projectRoot, window)

    this.dbManager = dbManager

    this.pricingManager = undefined
    this.agentRunTools = undefined
    this.orchestrator = undefined
  }

  async init(): Promise<void> {
    this.pricingManager = createPricingManager({ projectRoot: this.projectRoot })

    this.agentRunTools = createAgentRunTools(this.projectRoot)
    this.agentRunTools!.subscribe(async (agentRunUpdate) => {
      if (this.window) {
        this.window.webContents.send(IPC_HANDLER_KEYS.FACTORY_RUNS_SUBSCRIBE, agentRunUpdate)
      }
    })
    await this.agentRunTools.init()

    this.orchestrator = createOrchestrator({
      agentRunTools: this.agentRunTools,
      pricing: this.pricingManager,
    })

    console.log(
      '[factory] Pricing manager initialized. Loaded',
      this.pricingManager?.listPrices()?.prices?.length || 0,
      'prices.',
    )
    await super.init()
  }

  getHandlers(): Record<string, (args: any) => any> {
    const handlers: Record<string, (args: any) => any> = {}

    handlers[IPC_HANDLER_KEYS.FACTORY_PRICING_LIST] = () => this.listPrices()
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_CANCEL] = ({ runId, reason }) =>
      this.cancelRun(runId, reason)

    return handlers
  }
  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_LIST_ACTIVE] = () => this.listActiveRuns()
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_LIST_HISTORY] = () => this.getHistoryRuns()
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_GET] = ({ runId }) => this.getRun(runId)
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_DELETE_HISTORY] = ({ runId }) =>
      this.deleteHistoryRun(runId)
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_RATE] = ({ runId, rating }) =>
      this.rateRun(runId, rating)
    handlers[IPC_HANDLER_KEYS.FACTORY_RUNS_START] = (params) => this.startRun(params)
    handlers[IPC_HANDLER_KEYS.FACTORY_PRICING_REFRESH] = ({ provider, url }) =>
      this.refreshPrices(provider, url)

    return handlers
  }

  async startRun(params: AgentRun): Promise<AgentRunHistory> {
    console.log('[factory] START_STORY', this._maskSecrets(params))
    try {
      const dbConnectionString = this.dbManager.getConnectionString()
      return await this.orchestrator!.startRun({ ...params, dbConnectionString })
    } catch (err: any) {
      console.error('[factory] Failed to start story run', err?.stack || String(err))
      throw err
    }
  }

  cancelRun(runId: string, reason?: string) {
    this.orchestrator?.cancelRun(runId, reason)
  }

  async listActiveRuns(): Promise<string[]> {
    return (await this.orchestrator?.listActiveRuns()) ?? []
  }

  async getHistoryRuns(): Promise<AgentRunHistory[]> {
    return (await this.agentRunTools?.listRuns()) ?? []
  }

  async getRun(runId: string): Promise<AgentRunHistory | undefined> {
    return await this.agentRunTools?.getRun(runId)
  }

  async deleteHistoryRun(runId: string): Promise<void> {
    await this.agentRunTools?.deleteRun(runId)
  }

  async rateRun(runId: string, rating: AgentRunRatingPatch): Promise<AgentRunHistory | undefined> {
    return await this.agentRunTools?.rateRun(runId, rating)
  }

  listPrices(): PricingState | undefined {
    return this.pricingManager?.listPrices()
  }
  async refreshPrices(provider?: string, url?: string): Promise<PricingState | undefined> {
    return this.pricingManager?.refresh(provider, url)
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
}
