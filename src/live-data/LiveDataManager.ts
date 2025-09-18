import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { LiveDataStore } from './LiveDataStore'
import { LiveDataRegistry } from './LiveDataRegistry'
import { createAgentPricesProvider } from './providers/agentPricesProvider'
import { createFetchJsonProvider } from './providers/fetchJsonProvider'
import BaseManager from '../BaseManager'
import FactoryToolsManager from 'src/factory-tools/FactoryToolsManager'

export type LiveService = {
  id: string
  name: string
  description?: string
  freshnessPolicy: 'daily' | 'weekly' | 'monthly'
  autoUpdate: { enabled: boolean; trigger?: 'onAppLaunch' | 'manual'; time?: string }
  lastUpdated: number
  config: Record<string, any>
  isUpdating: boolean
  scope: 'global' | 'project'
  projectId: string | null
}

const DEFAULT_SERVICES: LiveService[] = [
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
]

export default class LiveDataManager extends BaseManager {
  private store: LiveDataStore
  private registry: LiveDataRegistry

  private factoryToolsManager: FactoryToolsManager

  private services: LiveService[]

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    factoryToolsManager: FactoryToolsManager,
  ) {
    super(projectRoot, window)
    this.store = new LiveDataStore()
    this.registry = new LiveDataRegistry()

    this.factoryToolsManager = factoryToolsManager

    this.services = this._loadServices()

    // Register built-in providers
    this.registry.register(createAgentPricesProvider(this.store, factoryToolsManager))
    // Generic provider enables future-proof dynamic services by URL
    this.registry.register(createFetchJsonProvider(this.store))
  }

  private _loadServices(): LiveService[] {
    const stored = this.store.getServices() as any
    if (stored && Array.isArray(stored)) {
      const normalized = stored.map((s: any) => normalizeService(s))
      // Ensure defaults exist
      const ids = new Set(normalized.map((s: any) => s.id))
      for (const def of DEFAULT_SERVICES) {
        if (!ids.has(def.id)) normalized.push(normalizeService(def))
      }
      return normalized
    }
    return DEFAULT_SERVICES.map((s) => normalizeService(s))
  }

  private _saveServices(): void {
    this.store.setServices(this.services)
  }

  async init(): Promise<void> {
    await super.init()
    this._maybeTriggerOnLaunchUpdates()
  }

  getHandlers(): Record<string, (args: any) => any> {
    const handlers: Record<string, (args: any) => any> = {}

    handlers[IPC_HANDLER_KEYS.LIVE_DATA_GET_STATUS] = () => this.getServicesStatus()
    handlers[IPC_HANDLER_KEYS.LIVE_DATA_UPDATE_CONFIG] = ({ serviceId, updates }) =>
      this.updateServiceConfig(serviceId, updates)
    handlers[IPC_HANDLER_KEYS.LIVE_DATA_ADD_SERVICE] = ({ service }) => this.addService(service)
    handlers[IPC_HANDLER_KEYS.LIVE_DATA_REMOVE_SERVICE] = ({ serviceId }) =>
      this.removeService(serviceId)
    return handlers
  }
  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.LIVE_DATA_TRIGGER_UPDATE] = async ({ serviceId }) =>
      await this.triggerUpdate(serviceId)
    handlers[IPC_HANDLER_KEYS.LIVE_DATA_GET_DATA] = async ({ serviceId }) =>
      await this.getServiceData(serviceId)
    return handlers
  }

  getServicesStatus(): (LiveService & { isFresh: boolean })[] {
    return this.services.map((svc) => ({ ...svc, isFresh: computeIsFresh(svc) }))
  }

  updateServiceConfig(serviceId: string, updates: Partial<LiveService>): LiveService | null {
    const idx = this.services.findIndex((s) => s.id === serviceId)
    if (idx === -1) return null
    const merged = normalizeService({ ...this.services[idx], ...updates })
    this.services[idx] = merged
    this._saveServices()
    this._emitStatus()
    return merged
  }

  addService(service: Partial<LiveService> & { id: string; name?: string }): LiveService {
    if (!service?.id) throw new Error('Service id is required')
    const exists = this.services.some((s) => s.id === service.id)
    if (exists) throw new Error('Service with this id already exists')

    const merged = normalizeService(service as any)
    this.services.push(merged)
    this._saveServices()
    this._emitStatus()
    return merged
  }

  removeService(serviceId: string): boolean {
    const idx = this.services.findIndex((s) => s.id === serviceId)
    if (idx === -1) return false
    this.services.splice(idx, 1)
    this._saveServices()
    this._emitStatus()
    return true
  }

  async triggerUpdate(serviceId: string): Promise<any> {
    const svc = this.services.find((s) => s.id === serviceId)
    if (!svc || svc.isUpdating) return this.getServicesStatus()

    svc.isUpdating = true
    this._emitStatus()

    try {
      // Select provider by most specific: service.id, or fall back to generic fetch-json
      let provider = this.registry.get(svc.id)
      if (!provider && (svc as any).config?.url) {
        provider = this.registry.get('fetch-json')
      }

      if (provider && typeof (provider as any).update === 'function') {
        await (provider as any).update(svc)
      } else {
        await new Promise((r) => setTimeout(r, 500))
      }

      svc.lastUpdated = Date.now()
    } catch (e: any) {
      console.error(`[live-data] update failed for ${serviceId}:`, e?.message || e)
    } finally {
      svc.isUpdating = false
      this._saveServices()
      this._emitStatus()
    }

    return this.getServicesStatus()
  }

  async getServiceData(serviceId: string): Promise<any> {
    const svc = this.services.find((s) => s.id === serviceId)
    if (!svc) return null

    try {
      let provider = this.registry.get(svc.id)
      if (!provider && (svc as any).config?.url) provider = this.registry.get('fetch-json')
      if (provider && typeof (provider as any).getData === 'function') {
        return await (provider as any).getData(svc)
      }
      return this.store.getServiceData(serviceId)
    } catch (e: any) {
      console.warn('[live-data] getServiceData error for', serviceId, e?.message || e)
      return this.store.getServiceData(serviceId) || null
    }
  }

  private _emitStatus(): void {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send(IPC_HANDLER_KEYS.LIVE_DATA_SUBSCRIBE, this.getServicesStatus())
    } catch (e: any) {
      console.warn('Failed to emit LIVE_DATA_SUBSCRIBE:', e)
    }
  }

  private _maybeTriggerOnLaunchUpdates(): void {
    for (const svc of this.services) {
      if (svc.autoUpdate?.enabled && svc.autoUpdate?.trigger === 'onAppLaunch') {
        if (!computeIsFresh(svc)) {
          this.triggerUpdate(svc.id) // fire-and-forget
        }
      }
    }
  }
}

export function normalizeService(service: any): LiveService {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    freshnessPolicy: service.freshnessPolicy || 'daily',
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
    config: service.config || {},
    isUpdating: !!service.isUpdating,
    scope: service.scope === 'project' ? 'project' : 'global',
    projectId: service.scope === 'project' ? service.projectId || null : null,
  }
}

export function computeIsFresh(service: LiveService, now = Date.now()): boolean {
  if (!service.lastUpdated) return false
  const diffMs = now - service.lastUpdated
  const dayMs = 24 * 60 * 60 * 1000
  switch (service.freshnessPolicy) {
    case 'daily':
      return diffMs < dayMs
    case 'weekly':
      return diffMs < 7 * dayMs
    case 'monthly':
      return diffMs < 30 * dayMs
    default:
      return false
  }
}
