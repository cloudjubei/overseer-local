
// and mirrors a snapshot into LiveDataStore for renderer consumption.
export function createAgentPricesProvider(store, factoryToolsManager) {
  return {
    id: 'agent-prices',
    update: async (service) => {
      // Allow URL override via service.config.url, otherwise fallback to litellm list
      const url = service?.config?.url || 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
      await factoryService.refreshPricing(undefined, url);

      // Pull snapshot for caching in store
      const snapshot = await factoryToolsManager.listPrices()
      store.setServiceData(service.id, snapshot);
      return true;
    },
    getData: async (service) => {
      try {
        return await factoryToolsManager.listPrices()
      } catch (_) {}
      return store.getServiceData(service.id) || { updatedAt: new Date().toISOString(), prices: [] };
    }
  };
}
