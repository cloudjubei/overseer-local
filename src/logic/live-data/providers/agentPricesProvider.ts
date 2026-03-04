import { LiveDataStore } from '../LiveDataStore'
import { LiveService } from '../LiveDataManager'
import FactoryLLMCostsManager from '../../factory/FactoryLLMCostsManager'

// and mirrors a snapshot into LiveDataStore for renderer consumption.
export function createAgentPricesProvider(
  store: LiveDataStore,
  factoryLLMCostsManager: FactoryLLMCostsManager,
) {
  return {
    id: 'agent-prices',
    update: async (service: LiveService) => {
      // Allow URL override via service.config.url, otherwise fallback to litellm list
      const url =
        service?.config?.url ||
        'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'

      await factoryLLMCostsManager.refreshPrices(undefined, url)

      const snapshot = factoryLLMCostsManager.listPrices()
      store.setServiceData(service.id, snapshot)
      return true
    },
    getData: async (service: LiveService) => {
      try {
        return factoryLLMCostsManager.listPrices()
      } catch (_) {}
      return store.getServiceData(service.id) || { updatedAt: new Date().toISOString(), prices: [] }
    },
  }
}
