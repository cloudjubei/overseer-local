import type { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import type { LLMConfig } from 'thefactory-tools'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import BaseManager from '../BaseManager'
import AppStorage from '../settings/AppStorage'

export type LLMConfigContext = 'chat' | 'agentRun'

export type LLMConfigsState = {
  configs: LLMConfig[]
  activeAgentRunConfigId: string
  recentAgentRunConfigIds: string[]
  activeChatConfigId: string
  recentChatConfigIds: string[]
}

const DEFAULT_STATE: LLMConfigsState = {
  configs: [],
  activeAgentRunConfigId: '',
  recentAgentRunConfigIds: [],
  activeChatConfigId: '',
  recentChatConfigIds: [],
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x) => typeof x === 'string') as string[]
}

function normalizeConfig(input: unknown): LLMConfig | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>

  const next = { ...raw }

  // apiUrlOverride should only be present as a non-empty string.
  // If empty or not a string, remove it so it stays undefined.
  if (typeof next.apiUrlOverride !== 'string' || next.apiUrlOverride === '') {
    delete next.apiUrlOverride
  }

  return next as unknown as LLMConfig
}

function normalizeState(value: unknown): LLMConfigsState {
  try {
    const v = (value ?? {}) as Partial<LLMConfigsState>
    const configs = Array.isArray(v.configs)
      ? (v.configs.map(normalizeConfig).filter(Boolean) as LLMConfig[])
      : []
    return {
      configs,
      activeAgentRunConfigId:
        typeof v.activeAgentRunConfigId === 'string' ? v.activeAgentRunConfigId : '',
      recentAgentRunConfigIds: normalizeStringArray(v.recentAgentRunConfigIds),
      activeChatConfigId: typeof v.activeChatConfigId === 'string' ? v.activeChatConfigId : '',
      recentChatConfigIds: normalizeStringArray(v.recentChatConfigIds),
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export default class LLMConfigsManager extends BaseManager {
  private storage: AppStorage
  private cache: LLMConfigsState

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)
    this.storage = new AppStorage('llm-configs')
    this.cache = this.__sanitizeState(this.__load())
  }

  getHandlers(): Record<string, (args: any) => any> {
    const handlers: Record<string, (args: any) => any> = {}

    handlers[IPC_HANDLER_KEYS.LLM_CONFIGS_LIST] = () => this.list()
    handlers[IPC_HANDLER_KEYS.LLM_CONFIGS_ADD] = ({ input }) => this.add(input)
    handlers[IPC_HANDLER_KEYS.LLM_CONFIGS_UPDATE] = ({ id, patch }) => this.update(id, patch)
    handlers[IPC_HANDLER_KEYS.LLM_CONFIGS_REMOVE] = ({ id }) => this.remove(id)

    handlers[IPC_HANDLER_KEYS.LLM_CONFIGS_GET_ACTIVE_AGENT_RUN] = () => this.getActiveAgentRunId()
    handlers[IPC_HANDLER_KEYS.LLM_CONFIGS_SET_ACTIVE_AGENT_RUN] = ({ id }) =>
      this.setActiveAgentRunId(id)
    handlers[IPC_HANDLER_KEYS.LLM_CONFIGS_GET_RECENT_AGENT_RUN] = () => this.getRecentAgentRunIds()

    handlers[IPC_HANDLER_KEYS.LLM_CONFIGS_GET_ACTIVE_CHAT] = () => this.getActiveChatId()
    handlers[IPC_HANDLER_KEYS.LLM_CONFIGS_SET_ACTIVE_CHAT] = ({ id }) => this.setActiveChatId(id)
    handlers[IPC_HANDLER_KEYS.LLM_CONFIGS_GET_RECENT_CHAT] = () => this.getRecentChatIds()

    handlers[IPC_HANDLER_KEYS.LLM_CONFIGS_BUMP_RECENT] = ({ context, id, limit }) =>
      this.bumpRecent(context, id, limit)

    return handlers
  }

  list(): LLMConfigsState {
    return this.cache
  }

  add(input: Omit<LLMConfig, 'id'>): LLMConfig {
    const normalized = normalizeConfig(input) as LLMConfig | null
    const next: LLMConfig = { ...(normalized || (input as LLMConfig)), id: uuidv4() }

    const configs = [...this.cache.configs, next]
    let state: LLMConfigsState = { ...this.cache, configs }

    // Set defaults if first config
    if (configs.length === 1) {
      state = {
        ...state,
        activeAgentRunConfigId: next.id!,
        activeChatConfigId: next.id!,
        recentAgentRunConfigIds: [next.id!],
        recentChatConfigIds: [next.id!],
      }
    }

    this.__persist(this.__sanitizeState(state))
    return next
  }

  update(id: string, patch: Partial<LLMConfig>): LLMConfig | undefined {
    const idx = this.cache.configs.findIndex((c) => c.id === id)
    if (idx === -1) return undefined

    const merged = { ...this.cache.configs[idx], ...patch, id }
    const updated = (normalizeConfig(merged) || merged) as LLMConfig

    const configs = [...this.cache.configs]
    configs[idx] = updated

    this.__persist(this.__sanitizeState({ ...this.cache, configs }))
    return updated
  }

  remove(id: string): void {
    const configs = this.cache.configs.filter((c) => c.id !== id)
    this.__persist(this.__sanitizeState({ ...this.cache, configs }))
  }

  getActiveAgentRunId(): string {
    return this.cache.activeAgentRunConfigId || ''
  }

  setActiveAgentRunId(id: string): void {
    const state: LLMConfigsState = { ...this.cache, activeAgentRunConfigId: id }
    this.__persist(this.__sanitizeState(state))
    this.bumpRecent('agentRun', id)
  }

  getActiveChatId(): string {
    return this.cache.activeChatConfigId || ''
  }

  setActiveChatId(id: string): void {
    const state: LLMConfigsState = { ...this.cache, activeChatConfigId: id }
    this.__persist(this.__sanitizeState(state))
    this.bumpRecent('chat', id)
  }

  getRecentAgentRunIds(): string[] {
    return this.cache.recentAgentRunConfigIds
  }

  getRecentChatIds(): string[] {
    return this.cache.recentChatConfigIds
  }

  bumpRecent(context: LLMConfigContext, id: string, limit = 10): void {
    if (!id) return

    if (context === 'agentRun') {
      const ids = this.cache.recentAgentRunConfigIds
      const next = [id, ...ids.filter((x) => x !== id)].slice(0, limit)
      this.__persist(this.__sanitizeState({ ...this.cache, recentAgentRunConfigIds: next }))
      return
    }

    const ids = this.cache.recentChatConfigIds
    const next = [id, ...ids.filter((x) => x !== id)].slice(0, limit)
    this.__persist(this.__sanitizeState({ ...this.cache, recentChatConfigIds: next }))
  }

  private __storageKey() {
    return 'llm_configs_state'
  }

  private __load(): LLMConfigsState {
    try {
      const raw = this.storage.getItem(this.__storageKey())
      if (!raw) return { ...DEFAULT_STATE }
      return normalizeState(JSON.parse(raw))
    } catch {
      return { ...DEFAULT_STATE }
    }
  }

  private __persist(next: LLMConfigsState): void {
    try {
      const normalized = this.__sanitizeState(next)
      this.storage.setItem(this.__storageKey(), JSON.stringify(normalized))
      this.cache = normalized
      this.__broadcast()
    } catch (e) {
      console.error('Failed to persist LLM configs:', e)
    }
  }

  private __broadcast(): void {
    try {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(IPC_HANDLER_KEYS.LLM_CONFIGS_SUBSCRIBE, {})
      }
    } catch (_) {}
  }

  private __sanitizeState(state: LLMConfigsState): LLMConfigsState {
    const configs = state.configs.map((c) => normalizeConfig(c) || c).filter(Boolean) as LLMConfig[]

    const presentIds = new Set(configs.map((c) => c.id).filter(Boolean) as string[])

    const recentAgentRunConfigIds = state.recentAgentRunConfigIds.filter((id) => presentIds.has(id))
    const recentChatConfigIds = state.recentChatConfigIds.filter((id) => presentIds.has(id))

    const fallback = configs[0]?.id || ''

    const activeAgentRunConfigId =
      state.activeAgentRunConfigId && presentIds.has(state.activeAgentRunConfigId)
        ? state.activeAgentRunConfigId
        : fallback

    const activeChatConfigId =
      state.activeChatConfigId && presentIds.has(state.activeChatConfigId)
        ? state.activeChatConfigId
        : fallback

    return {
      ...state,
      configs,
      activeAgentRunConfigId,
      activeChatConfigId,
      recentAgentRunConfigIds,
      recentChatConfigIds,
    }
  }
}
