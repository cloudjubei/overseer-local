import { ipcMain } from 'electron';
import AppStorage from '../settings/appStorage';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';
import { getPricingManager } from '../tools/factory/mainOrchestrator';

const DEFAULT_SERVICES_CONFIG = [
  {
    id: 'agent-prices',
    name: 'Agent Prices',
    description: 'Fetches the latest prices for common AI models from various providers.',
    freshnessPolicy: 'daily',
    autoUpdate: { enabled: true, trigger: 'onAppLaunch' },
    lastUpdated: 0,
    config: {},
    isUpdating: false,
  }
];

export class LiveDataManager {
  constructor(projectRoot, window) {
    this.projectRoot = projectRoot;
    this.window = window;
    this.storage = new AppStorage('live-data');
    this.services = this._loadServices();
    this._ipcBound = false;

    // Registry of provider-specific handlers (update/getData)
    this.providerHandlers = {
      'agent-prices': {
        update: async (service) => {
          try {
            const pricing = getPricingManager();
            if (!pricing) throw new Error('Pricing manager not initialized');
            // Optionally, service.config could include provider or URL overrides in the future
            await pricing.refresh();
            return true;
          } catch (e) {
            console.error('[live-data] agent-prices update failed:', e?.message || e);
            return false;
          }
        },
        getData: async () => {
          try {
            const pricing = getPricingManager();
            return pricing?.listPrices?.() || { updatedAt: new Date().toISOString(), prices: [] };
          } catch (e) {
            return { updatedAt: new Date().toISOString(), prices: [] };
          }
        }
      }
    };
  }

  _storageKey() {
    return 'services-config';
  }

  _normalizeServiceShape(service) {
    // Ensure persisted services match the latest shape
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      freshnessPolicy: service.freshnessPolicy || service.freshness || 'daily',
      autoUpdate: typeof service.autoUpdate === 'object'
        ? { enabled: !!service.autoUpdate.enabled, trigger: service.autoUpdate.trigger || 'onAppLaunch' }
        : { enabled: !!service.autoUpdate, trigger: 'onAppLaunch' },
      lastUpdated: typeof service.lastUpdated === 'number' ? service.lastUpdated : (service.lastUpdated ? new Date(service.lastUpdated).getTime() : 0),
      config: service.config || {},
      isUpdating: !!service.isUpdating,
    };
  }

  _loadServices() {
    try {
      const stored = this.storage.getItem(this._storageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        const mapped = Array.isArray(parsed) ? parsed.map(s => this._normalizeServiceShape(s)) : [];
        const serviceIds = new Set(mapped.map(s => s.id));
        for (const defaultService of DEFAULT_SERVICES_CONFIG) {
          if (!serviceIds.has(defaultService.id)) {
            mapped.push(this._normalizeServiceShape(defaultService));
          }
        }
        return mapped;
      } else {
        return DEFAULT_SERVICES_CONFIG.map(s => this._normalizeServiceShape(s));
      }
    } catch (e) {
      console.error('Error loading live data services config:', e);
      return DEFAULT_SERVICES_CONFIG.map(s => this._normalizeServiceShape(s));
    }
  }

  _saveServices() {
    try {
      this.storage.setItem(this._storageKey(), JSON.stringify(this.services));
    } catch (error) {
      console.error('Failed to save live data services config:', error);
    }
  }
  
  async init() {
    this._registerIpcHandlers();
    
    this._maybeTriggerOnLaunchUpdates();
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_GET_STATUS, () => this.getServicesStatus());
    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_TRIGGER_UPDATE, (_event, { serviceId }) => this.triggerUpdate(serviceId));
    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_UPDATE_CONFIG, (_event, { serviceId, updates }) => this.updateServiceConfig(serviceId, updates));
    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_GET_DATA, (_event, { serviceId }) => this.getServiceData(serviceId));

    this._ipcBound = true;
  }

  getServicesStatus() {
    return this.services.map(service => {
      const isFresh = this._isDataFresh(service);
      return { ...service, isFresh };
    });
  }
  
  _isDataFresh(service) {
    if (!service.lastUpdated) return false;
    const now = Date.now();
    const diffMs = now - service.lastUpdated;
    const dayMs = 24 * 60 * 60 * 1000;
    switch (service.freshnessPolicy) {
      case 'daily':
        return diffMs < dayMs;
      case 'weekly':
        return diffMs < 7 * dayMs;
      case 'monthly':
        return diffMs < 30 * dayMs; // Approximation
      default:
        return false;
    }
  }

  updateServiceConfig(serviceId, updates) {
    const idx = this.services.findIndex(s => s.id === serviceId);
    if (idx !== -1) {
      const before = this.services[idx];
      // Shallow merge with normalization for known fields
      const merged = this._normalizeServiceShape({ ...before, ...updates });
      this.services[idx] = merged;
      this._saveServices();
      this._emitStatus();
      return merged;
    }
    return null;
  }

  async triggerUpdate(serviceId) {
    const service = this.services.find(s => s.id === serviceId);
    if (!service || service.isUpdating) {
      return this.getServicesStatus();
    }

    service.isUpdating = true;
    this._emitStatus();

    try {
      const handler = this.providerHandlers?.[serviceId]?.update;
      if (typeof handler === 'function') {
        await handler(service);
      } else {
        // Default behavior: simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      service.lastUpdated = Date.now();
    } catch (error) {
      console.error(`Error updating live data service ${serviceId}:`, error);
    } finally {
      service.isUpdating = false;
      this._saveServices();
      this._emitStatus();
    }

    return this.getServicesStatus();
  }

  async getServiceData(serviceId) {
    try {
      const handler = this.providerHandlers?.[serviceId]?.getData;
      if (typeof handler === 'function') {
        return await handler();
      }
      return null;
    } catch (e) {
      console.warn('[live-data] getServiceData failed for', serviceId, e?.message || e);
      return null;
    }
  }

  _emitStatus() {
    if (!this.window || this.window.isDestroyed()) return;
    try {
      this.window.webContents.send(IPC_HANDLER_KEYS.LIVE_DATA_SUBSCRIBE, this.getServicesStatus());
    } catch (e) {
      console.warn('Failed to emit LIVE_DATA_SUBSCRIBE:', e);
    }
  }

  _maybeTriggerOnLaunchUpdates() {
    // If autoUpdate.enabled && trigger === 'onAppLaunch' and not fresh, trigger update
    for (const svc of this.services) {
      if (svc.autoUpdate?.enabled && svc.autoUpdate?.trigger === 'onAppLaunch') {
        const fresh = this._isDataFresh(svc);
        if (!fresh) {
          // Fire and forget; no await to not block app start
          this.triggerUpdate(svc.id);
        }
      }
    }
  }

  stopWatching() {
    // no-op for now; placeholder for timers if we add scheduled trigger
  }
}
