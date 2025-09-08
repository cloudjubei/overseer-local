import { getPricingManager } from '../../tools/factory/mainOrchestrator';

// Agent Prices provider bridges to factory-ts pricing manager.
// It does not persist its own data; instead, it refreshes pricing manager
// and mirrors a snapshot into LiveDataStore for renderer consumption.
export function createAgentPricesProvider(store) {
  return {
    id: 'agent-prices',
    update: async (service) => {
      const pricing = getPricingManager();
      if (!pricing) throw new Error('Pricing manager not initialized');
      // Allow URL override via service.config.url, otherwise fallback to litellm list
      const url = service?.config?.url || 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
      await pricing.refresh(undefined, url);

      // Pull snapshot for caching in store
      const snapshot = typeof pricing.listPrices === 'function'
        ? pricing.listPrices()
        : { updatedAt: new Date().toISOString(), prices: [] };
      store.setServiceData(service.id, snapshot);
      return true;
    },
    getData: async (service) => {
      // First prefer pricing manager real-time, fallback to cached store
      try {
        const pricing = getPricingManager();
        if (pricing && typeof pricing.listPrices === 'function') {
          const snapshot = pricing.listPrices();
          if (snapshot) return snapshot;
        }
      } catch (_) {}
      return store.getServiceData(service.id) || { updatedAt: new Date().toISOString(), prices: [] };
    }
  };
}
