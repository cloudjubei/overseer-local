import { v4 as uuidv4 } from 'uuid';

export interface LLMConfig {
  id: string;
  name: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
}

export class LLMConfigManager {
  private storageKey = 'llmConfigs';
  private activeKey = 'activeLlmConfigId';

  getConfigs(): LLMConfig[] {
    const stored = localStorage.getItem(this.storageKey);
    return stored ? JSON.parse(stored) : [];
  }

  saveConfigs(configs: LLMConfig[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(configs));
  }

  getActiveId(): string | null {
    return localStorage.getItem(this.activeKey);
  }

  setActiveId(id: string): void {
    localStorage.setItem(this.activeKey, id);
  }

  getActiveConfig(): LLMConfig | null {
    const configs = this.getConfigs();
    const activeId = this.getActiveId();
    return configs.find(c => c.id === activeId) || null;
  }

  addConfig(config: Omit<LLMConfig, 'id'>): LLMConfig {
    const newConfig = { ...config, id: uuidv4() };
    const configs = this.getConfigs();
    configs.push(newConfig);
    this.saveConfigs(configs);
    if (configs.length === 1) {
      this.setActiveId(newConfig.id);
    }
    return newConfig;
  }

  updateConfig(id: string, updates: Partial<LLMConfig>): void {
    const configs = this.getConfigs();
    const index = configs.findIndex(c => c.id === id);
    if (index !== -1) {
      configs[index] = { ...configs[index], ...updates };
      this.saveConfigs(configs);
    }
  }

  removeConfig(id: string): void {
    let configs = this.getConfigs();
    configs = configs.filter(c => c.id !== id);
    this.saveConfigs(configs);
    if (this.getActiveId() === id) {
      this.setActiveId(configs[0]?.id || '');
    }
  }

  isConfigured(): boolean {
    return !!this.getActiveConfig()?.apiKey;
  }
}
