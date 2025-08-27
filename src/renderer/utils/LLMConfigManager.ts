import { v4 as uuidv4 } from 'uuid';
import type { LLMConfig } from '../types';

export const LLM_CONFIGS_CHANGED_EVENT = 'llm-configs-changed';

export class LLMConfigManager {
  private storageKey = 'llmConfigs';
  private activeKey = 'activeLlmConfigId';

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
    this.notify();
  }

  getActiveId(): string | null {
    return localStorage.getItem(this.activeKey);
  }

  setActiveId(id: string): void {
    localStorage.setItem(this.activeKey, id);
    this.notify();
  }

  getActiveConfig(): LLMConfig | null {
    const configs = this.getConfigs();
    const activeId = this.getActiveId();
    return configs.find(c => c.id === activeId) || null;
  }

  addConfig(config: Omit<LLMConfig, 'id'>): LLMConfig {
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
    if (this.getActiveId() === id) {
      this.setActiveId(configs[0]?.id || '');
    } else {
      this.notify();
    }
  }

  isConfigured(): boolean {
    return !!this.getActiveConfig()?.apiKey;
  }
}
