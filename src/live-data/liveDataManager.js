import { ipcMain } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { LiveDataStore } from './LiveDataStore'
import { LiveDataRegistry } from './LiveDataRegistry'
import { createAgentPricesProvider } from './providers/agentPricesProvider'
import { createFetchJsonProvider } from './providers/fetchJsonProvider'

const DEFAULT_SERVICES = [
  {
    id: 'agent-prices',
    name: 'Agent Prices',
    description: 'Fetches the latest prices for common AI models from various providers.',
    freshnessPolicy: 'daily',
    autoUpdate: { enabled: true, trigger: 'onAppLaunch' },
    lastUpdated: 0,
    config: {
      url: 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
    },
    isUpdating: false,
    scope: 'global',
    projectId: null,
  },
  // Example slot for a dynamic JSON fetch service (user can add more via UI in future)
  // { id: 'my-json-service', name: 'My JSON', description: 'Fetches custom JSON', freshnessPolicy: 'weekly', autoUpdate: { enabled: false }, config: { url: 'https://example.com/data.json' } }
]

export class LiveDataManager {
  constructor(projectRoot, window, factoryToolsManager) {
    this.projectRoot = projectRoot
    this.window = window

    this.store = new LiveDataStore()
    this.registry = new LiveDataRegistry()
    this._ipcBound = false

    this.factoryToolsManager = factoryToolsManager

    this.services = this._loadServices()

    // Register built-in providers
    this.registry.register(createAgentPricesProvider(this.store, factoryToolsManager))
    // Generic provider enables future-proof dynamic services by URL
    this.registry.register(createFetchJsonProvider(this.store))
  }

  _loadServices() {
    const stored = this.store.getServices()
    if (stored && Array.isArray(stored)) {
      const normalized = stored.map((s) => normalizeService(s))
      // Ensure defaults exist
      const ids = new Set(normalized.map((s) => s.id))
      for (const def of DEFAULT_SERVICES) {
        if (!ids.has(def.id)) normalized.push(normalizeService(def))
      }
      return normalized
    }
    return DEFAULT_SERVICES.map((s) => normalizeService(s))
  }

  _saveServices() {
    this.store.setServices(this.services)
  }

  async init() {
    this._registerIpcHandlers()
    this._maybeTriggerOnLaunchUpdates()
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return

    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_GET_STATUS, () => this.getServicesStatus())
    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_TRIGGER_UPDATE, (_event, { serviceId }) =>
      this.triggerUpdate(serviceId),
    )
    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_UPDATE_CONFIG, (_event, { serviceId, updates }) =>
      this.updateServiceConfig(serviceId, updates),
    )
    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_GET_DATA, (_event, { serviceId }) =>
      this.getServiceData(serviceId),
    )
    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_ADD_SERVICE, (_event, { service }) =>
      this.addService(service),
    )
    ipcMain.handle(IPC_HANDLER_KEYS.LIVE_DATA_REMOVE_SERVICE, (_event, { serviceId }) =>
      this.removeService(serviceId),
    )

    this._ipcBound = true
  }

  getServicesStatus() {
    return this.services.map((svc) => ({ ...svc, isFresh: computeIsFresh(svc) }))
  }

  updateServiceConfig(serviceId, updates) {
    const idx = this.services.findIndex((s) => s.id === serviceId)
    if (idx === -1) return null
    const merged = normalizeService({ ...this.services[idx], ...updates })
    this.services[idx] = merged
    this._saveServices()
    this._emitStatus()
    return merged
  }

  addService(service) {
    // Allows users to add new services by specifying id, name, url, and update settings.
    if (!service?.id) throw new Error('Service id is required')
    const exists = this.services.some((s) => s.id === service.id)
    if (exists) throw new Error('Service with this id already exists')

    // If service.type is 'fetch-json' we keep its id unique and will use generic provider.
    // If service.id matches a provider id (like 'agent-prices'), it will use that provider.

    const merged = normalizeService(service)
    this.services.push(merged)
    this._saveServices()
    this._emitStatus()
    return merged
  }

  removeService(serviceId) {
    const idx = this.services.findIndex((s) => s.id === serviceId)
    if (idx === -1) return false
    this.services.splice(idx, 1)
    this._saveServices()
    this._emitStatus()
    return true
  }

  async triggerUpdate(serviceId) {
    const svc = this.services.find((s) => s.id === serviceId)
    if (!svc || svc.isUpdating) return this.getServicesStatus()

    svc.isUpdating = true
    this._emitStatus()

    try {
      // Select provider by most specific: service.id, or fall back to generic fetch-json
      let provider = this.registry.get(svc.id)
      if (!provider && svc.config?.url) {
        provider = this.registry.get('fetch-json')
      }

      if (provider && typeof provider.update === 'function') {
        await provider.update(svc)
      } else {
        // No provider registered; do nothing but simulate delay
        await new Promise((r) => setTimeout(r, 500))
      }

      svc.lastUpdated = Date.now()
    } catch (e) {
      console.error(`[live-data] update failed for ${serviceId}:`, e?.message || e)
    } finally {
      svc.isUpdating = false
      this._saveServices()
      this._emitStatus()
    }

    return this.getServicesStatus()
  }

  async getServiceData(serviceId) {
    const svc = this.services.find((s) => s.id === serviceId)
    if (!svc) return null

    try {
      let provider = this.registry.get(svc.id)
      if (!provider && svc.config?.url) provider = this.registry.get('fetch-json')
      if (provider && typeof provider.getData === 'function') {
        return await provider.getData(svc)
      }
      return this.store.getServiceData(serviceId)
    } catch (e) {
      console.warn('[live-data] getServiceData error for', serviceId, e?.message || e)
      return this.store.getServiceData(serviceId) || null
    }
  }

  _emitStatus() {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send(IPC_HANDLER_KEYS.LIVE_DATA_SUBSCRIBE, this.getServicesStatus())
    } catch (e) {
      console.warn('Failed to emit LIVE_DATA_SUBSCRIBE:', e)
    }
  }

  _maybeTriggerOnLaunchUpdates() {
    for (const svc of this.services) {
      if (svc.autoUpdate?.enabled && svc.autoUpdate?.trigger === 'onAppLaunch') {
        if (!computeIsFresh(svc)) {
          this.triggerUpdate(svc.id) // fire-and-forget
        }
      }
    }
  }

  stopWatching() {
    // Placeholder for future scheduled triggers
  }
}

// Normalize shape for service entries read from storage or defaults
export function normalizeService(service) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    freshnessPolicy: service.freshnessPolicy || service.freshnessPolicy || 'daily',
    autoUpdate:
      typeof service.autoUpdate === 'object'
        ? {
            enabled: !!service.autoUpdate.enabled,
            trigger: service.autoUpdate.trigger || 'onAppLaunch',
            time: service.autoUpdate.time,
          }
        : { enabled: !!service.autoUpdate, trigger: 'onAppLaunch' },
    lastUpdated:
      typeof service.lastUpdated === 'number'
        ? service.lastUpdated
        : service.lastUpdated
          ? new Date(service.lastUpdated).getTime()
          : 0,
    config: service.config || {}, // free-form; may include url, headers, params, etc.
    isUpdating: !!service.isUpdating,
    scope: service.scope === 'project' ? 'project' : 'global',
    projectId: service.scope === 'project' ? service.projectId || null : null,
  }
}

// Interface (documentation) for providers
// A provider implementation must expose: { id, update(service, deps), getData(service, deps) }
// - id: string (matches service id for built-ins or a generic provider id for dynamic services)
// - update: performs network or internal refresh, should persist data via store if applicable
// - getData: returns current data snapshot for the service

export function computeIsFresh(service, now = Date.now()) {
  if (!service.lastUpdated) return false
  const diffMs = now - service.lastUpdated
  const dayMs = 24 * 60 * 60 * 1000
  switch (service.freshnessPolicy) {
    case 'daily':
      return diffMs < dayMs
    case 'weekly':
      return diffMs < 7 * dayMs
    case 'monthly':
      return diffMs < 30 * dayMs // Approximate month
    default:
      return false
  }
}
