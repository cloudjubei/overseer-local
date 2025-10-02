import type { LLMConfig } from 'thefactory-tools'
import { v4 as uuidv4 } from 'uuid'

export const LLM_CONFIGS_CHANGED_EVENT = 'llm-configs-changed'

export class LLMConfigManager {
  private storageKey = 'llmConfigs'

  private activeAgentRunKey = 'activeAgentRunConfigId'
  private recentAgentRunKey = 'recentAgentRunConfigIds'

  private activeChatKey = 'activeChatConfigId'
  private recentChatKey = 'recentChatConfigIds'

  private notify() {
    try {
      window.dispatchEvent(new CustomEvent(LLM_CONFIGS_CHANGED_EVENT))
    } catch {}
  }

  getConfigs(): LLMConfig[] {
    const stored = localStorage.getItem(this.storageKey)
    return stored ? JSON.parse(stored) : []
  }

  saveConfigs(configs: LLMConfig[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(configs))
    try {
      const presentIds = new Set(configs.map((c) => c.id))

      const idsAgentRun = this.getAgentRunRecentIds()
      this.saveAgentRunRecentIds(idsAgentRun.filter((id) => presentIds.has(id)))

      const agentRunActiveId = this.getAgentRunActiveId()
      if (agentRunActiveId && !presentIds.has(agentRunActiveId)) {
        this.setAgentRunActiveId(configs[0]?.id || '')
      }

      const idsChat = this.getChatRecentIds()
      this.saveChatRecentIds(idsChat.filter((id) => presentIds.has(id)))

      const chatActiveId = this.getChatActiveId()
      if (chatActiveId && !presentIds.has(chatActiveId)) {
        this.setChatActiveId(configs[0]?.id || '')
      }
    } catch {}
    this.notify()
  }

  getAgentRunActiveId(): string {
    return localStorage.getItem(this.activeAgentRunKey) ?? ''
  }
  setAgentRunActiveId(id: string): void {
    console.log('LLMConfigManager setAgentRunActiveId id: ', id)
    localStorage.setItem(this.activeAgentRunKey, id)
    this.bumpAgentRunRecent(id)
    this.notify()
  }
  getAgentRunActiveConfig(): LLMConfig | undefined {
    const configs = this.getConfigs()
    const activeId = this.getAgentRunActiveId()
    return configs.find((c) => c.id === activeId)
  }

  getChatActiveId(): string {
    return localStorage.getItem(this.activeChatKey) ?? ''
  }
  setChatActiveId(id: string): void {
    console.log('LLMConfigManager setChatActiveId id: ', id)
    localStorage.setItem(this.activeChatKey, id)
    this.bumpChatRecent(id)
    this.notify()
  }
  getChatActiveConfig(): LLMConfig | undefined {
    const configs = this.getConfigs()
    const activeId = this.getChatActiveId()
    return configs.find((c) => c.id === activeId)
  }

  addConfig(config: Omit<LLMConfig, 'id'>): LLMConfig {
    const newConfig: LLMConfig = { ...config, id: uuidv4() }
    const configs = this.getConfigs()
    configs.push(newConfig)
    this.saveConfigs(configs)
    if (configs.length === 1) {
      this.setAgentRunActiveId(newConfig.id!)
      this.setChatActiveId(newConfig.id!)
    }
    return newConfig
  }

  updateConfig(id: string, updates: Partial<LLMConfig>): void {
    const configs = this.getConfigs()
    const index = configs.findIndex((c) => c.id === id)
    if (index !== -1) {
      configs[index] = { ...configs[index], ...updates }
      this.saveConfigs(configs)
    }
  }

  removeConfig(id: string): void {
    let configs = this.getConfigs()
    configs = configs.filter((c) => c.id !== id)
    this.saveConfigs(configs)
  }

  private saveAgentRunRecentIds(ids: string[]) {
    try {
      localStorage.setItem(this.recentAgentRunKey, JSON.stringify(ids))
    } catch {}
  }
  getAgentRunRecentIds(): string[] {
    try {
      const raw = localStorage.getItem(this.recentAgentRunKey)
      const arr = raw ? JSON.parse(raw) : []
      if (!Array.isArray(arr)) return []
      return arr.filter((x) => typeof x === 'string')
    } catch {
      return []
    }
  }
  bumpAgentRunRecent(id: string) {
    console.log('LLMConfigManager bumpAgentRunRecent id: ', id)
    try {
      const ids = this.getAgentRunRecentIds()
      const next = [id, ...ids.filter((x) => x !== id)]
      this.saveAgentRunRecentIds(next.slice(0, 10))
    } catch {}
  }

  private saveChatRecentIds(ids: string[]) {
    try {
      localStorage.setItem(this.recentChatKey, JSON.stringify(ids))
    } catch {}
  }
  getChatRecentIds(): string[] {
    try {
      const raw = localStorage.getItem(this.recentChatKey)
      const arr = raw ? JSON.parse(raw) : []
      if (!Array.isArray(arr)) return []
      return arr.filter((x) => typeof x === 'string')
    } catch {
      return []
    }
  }
  bumpChatRecent(id: string) {
    try {
      const ids = this.getChatRecentIds()
      const next = [id, ...ids.filter((x) => x !== id)]
      this.saveChatRecentIds(next.slice(0, 10))
      console.log('LLMConfigManager bumpChatRecent id: ', id)
    } catch {}
  }
}
