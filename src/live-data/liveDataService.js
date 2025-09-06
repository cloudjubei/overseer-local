import { ipcMain } from 'electron';
import AppStorage from '../settings/appStorage';
import IPC_HANDLER_KEYS from '../ipcHandlersKeys';

const DEFAULT_SERVICES_CONFIG = [
  {
    id: 'agent-prices',
    name: 'Agent Prices',
    description: 'Fetches the latest prices for common AI models from various providers.',
    freshness: 'daily', // 'daily', 'weekly', 'monthly'
    autoUpdate: true,
    lastUpdated: null,
    isUpdating: false,
  }
];

export class LiveDataService {
  constructor(projectRoot, window) {
    this.projectRoot = projectRoot;
    this.window = window;
    this.storage = new AppStorage('live-data');
    this.services = this._loadServices();
    this._ipcBound = false;
  }

  _storageKey() {
    return 'services-config';
  }

  _loadServices() {
    try {
      const stored = this.storage.getItem(this._storageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        const serviceIds = new Set(parsed.map(s => s.id));
        for (const defaultService of DEFAULT_SERVICES_CONFIG) {
          if (!serviceIds.has(defaultService.id)) {
            parsed.push(defaultService);
          }
        }
        return parsed;
      } else {
        return DEFAULT_SERVICES_CONFIG;
      }
    } catch (e) {
      console.error('Error loading live data services config:', e);
      return DEFAULT_SERVICES_CONFIG;
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
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_GET_STATUS, () => this.getServicesStatus());
    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_TRIGGER_UPDATE, (_event, { serviceId }) => this.triggerUpdate(serviceId));
    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_UPDATE_CONFIG, (_event, { serviceId, updates }) => this.updateServiceConfig(serviceId, updates));

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

      const now = new Date();
      const lastUpdated = new Date(service.lastUpdated);
      const diff = now.getTime() - lastUpdated.getTime();
      const diffDays = diff / (1000 * 3600 * 24);

      switch (service.freshness) {
          case 'daily':
              return diffDays < 1;
          case 'weekly':
              return diffDays < 7;
          case 'monthly':
              return diffDays < 30; // Approximation
          default:
              return false;
      }
  }

  updateServiceConfig(serviceId, updates) {
    const service = this.services.find(s => s.id === serviceId);
    if (service) {
      Object.assign(service, updates);
      this._saveServices();
      this.window.webContents.send(IPC_HANDLER_KEYS.LIVE_DATA_STATUS_UPDATED, this.getServicesStatus());
      return service;
    }
    return null;
  }

  async triggerUpdate(serviceId) {
    const service = this.services.find(s => s.id === serviceId);
    if (!service || service.isUpdating) {
      return;
    }

    service.isUpdating = true;
    this.window.webContents.send(IPC_HANDLER_KEYS.LIVE_DATA_STATUS_UPDATED, this.getServicesStatus());

    try {
      // In a real scenario, we would call a function to fetch the data.
      // For now, we just simulate it.
      await new Promise(resolve => setTimeout(resolve, 2000)); // simulate network request
      
      service.lastUpdated = new Date().toISOString();

    } catch (error) {
      console.error(`Error updating live data service ${serviceId}:`, error);
    } finally {
      service.isUpdating = false;
      this._saveServices();
      this.window.webContents.send(IPC_HANDLER_KEYS.LIVE_DATA_STATUS_UPDATED, this.getServicesStatus());
    }
  }

  stopWatching() {
    // cleanup if needed
  }
}
