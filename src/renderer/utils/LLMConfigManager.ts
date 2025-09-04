import { LLMConfig } from 'packages/factory-ts/src/types';
import { v4 as uuidv4 } from 'uuid';

export const LLM_CONFIGS_CHANGED_EVENT = 'llm-configs-changed';

export class LLMConfigManager {
  private storageKey = 'llmConfigs';
  private activeKey = 'activeLlmConfigId';
  private recentKey = 'recentLlmConfigIds';

  private notify() {
    try {
      window.dispatchEvent(new CustomEvent(LLM_CONFIGS_CHANGED_EVENT));
    } catch {}
  }

  getConfigs(): LLMConfig[] {
    const stored = localStorage.getItem(this.storageKey);
    return stored ? JSON.parse(stored) : [];
  }

  saveConfigs(configs: LLMConfig[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(configs));
    // Clean recents to only include existing IDs
    try {
      const ids = this.getRecentIds();
      const set = new Set(configs.map(c => c.id));
      const cleaned = ids.filter(id => set.has(id));
      localStorage.setItem(this.recentKey, JSON.stringify(cleaned));
    } catch {}
    this.notify();
  }

  getActiveId(): string | null {
    return localStorage.getItem(this.activeKey);
  }

  setActiveId(id: string): void {
    localStorage.setItem(this.activeKey, id);
    // bump recents order
    this.bumpRecent(id);
    this.notify();
  }

  getActiveConfig(): LLMConfig | null {
    const configs = this.getConfigs();
    const activeId = this.getActiveId();
    return configs.find(c => c.id === activeId) || null;
  }

  addConfig(config: LLMConfig): LLMConfig {
    const newConfig: LLMConfig = { ...config, id: uuidv4() } as LLMConfig;
    const configs = this.getConfigs();
    configs.push(newConfig);
    this.saveConfigs(configs);
    if (configs.length === 1) {
      this.setActiveId(newConfig.id);
    } else {
      this.notify();
    }
    return newConfig;
  }

  updateConfig(id: string, updates: Partial<LLMConfig>): void {
    const configs = this.getConfigs();
    const index = configs.findIndex(c => c.id === id);
    if (index !== -1) {
      configs[index] = { ...configs[index], ...updates };
      this.saveConfigs(configs);
    } else {
      this.notify();
    }
  }

  removeConfig(id: string): void {
    let configs = this.getConfigs();
    configs = configs.filter(c => c.id !== id);
    this.saveConfigs(configs);
    // remove from recents if present
    try {
      const ids = this.getRecentIds().filter(x => x !== id);
      localStorage.setItem(this.recentKey, JSON.stringify(ids));
    } catch {}
    if (this.getActiveId() === id) {
      this.setActiveId(configs[0]?.id || '');
    } else {
      this.notify();
    }
  }

  isConfigured(): boolean {
    return !!this.getActiveConfig()?.apiKey;
  }

  getRecentIds(): string[] {
    try {
      const raw = localStorage.getItem(this.recentKey);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter((x) => typeof x === 'string');
    } catch {
      return [];
    }
  }

  private saveRecentIds(ids: string[]) {
    try {
      localStorage.setItem(this.recentKey, JSON.stringify(ids));
    } catch {}
  }

  bumpRecent(id: string) {
    try {
      const ids = this.getRecentIds();
      const next = [id, ...ids.filter(x => x !== id)];
      // keep a reasonable history
      this.saveRecentIds(next.slice(0, 10));
    } catch {}
  }
}
