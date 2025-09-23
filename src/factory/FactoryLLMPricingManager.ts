import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { createPricingManager, PricingManager } from 'thefactory-tools'
import BaseManager from '../BaseManager'
import { PricingState } from 'thefactory-tools/dist/pricing'

export default class FactoryLLMPricingManager extends BaseManager {
  private pricingManager?: PricingManager

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)

    this.pricingManager = undefined
  }

  async init(): Promise<void> {
    this.pricingManager = createPricingManager({ projectRoot: this.projectRoot })

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

    return handlers
  }
  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.FACTORY_PRICING_REFRESH] = ({ provider, url }) =>
      this.refreshPrices(provider, url)

    return handlers
  }

  getManager(): PricingManager | undefined {
    return this.pricingManager
  }

  listPrices(): PricingState | undefined {
    return this.pricingManager?.listPrices()
  }
  async refreshPrices(provider?: string, url?: string): Promise<PricingState | undefined> {
    return this.pricingManager?.refresh(provider, url)
  }
}
