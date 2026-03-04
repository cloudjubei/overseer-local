import type { BrowserWindow } from 'electron'
import { createLLMCostsTools } from 'thefactory-tools'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import BaseManager from '../BaseManager'
import type { PricingState, LLMCostAggregateContent, LLMCostsTools } from 'thefactory-tools'
import DatabaseManager from '../db/DatabaseManager'

export default class FactoryLLMCostsManager extends BaseManager {
  private databaseManager: DatabaseManager
  private tools?: LLMCostsTools
  private _connectionString: string | undefined = undefined

  constructor(projectRoot: string, window: BrowserWindow, databaseManager: DatabaseManager) {
    super(projectRoot, window)
    this.databaseManager = databaseManager
    this.tools = undefined
  }

  async init(): Promise<void> {
    this._connectionString = this.databaseManager.getConnectionString()
    this.tools = createLLMCostsTools(this.projectRoot, this._connectionString)

    console.log(
      '[factory] LLMCostsTools initialized. Loaded',
      this.tools?.listPrices()?.prices?.length || 0,
      'prices.',
    )
    await super.init()
  }

  getHandlers(): Record<string, (args: any) => any> {
    const handlers: Record<string, (args: any) => any> = {}

    handlers[IPC_HANDLER_KEYS.FACTORY_PRICING_LIST] = () => this.listPrices()

    return handlers
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.FACTORY_PRICING_REFRESH] = ({ provider, url }) =>
      this.refreshPrices(provider, url)

    handlers[IPC_HANDLER_KEYS.FACTORY_COSTS_GET] = ({ chatKey }) => this.getCost(chatKey)

    return handlers
  }

  getTools(): LLMCostsTools | undefined {
    const connectionString = this.databaseManager.getConnectionString()
    if (connectionString !== this._connectionString) {
      this._connectionString = connectionString
      this.tools = createLLMCostsTools(this.projectRoot, this._connectionString)
    }
    return this.tools
  }

  listPrices(): PricingState | undefined {
    return this.tools?.listPrices()
  }

  async refreshPrices(provider?: string, url?: string): Promise<PricingState | undefined> {
    return this.tools?.refreshPrices(provider, url)
  }

  async getCost(chatKey: string): Promise<LLMCostAggregateContent | undefined> {
    // Always use getTools() so we re-init tools if DB connection changes.
    const tools = this.getTools()
    return tools?.getCost(chatKey)
  }
}
