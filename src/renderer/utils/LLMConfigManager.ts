export class LLMConfigManager {
  static STORAGE_KEY = 'llmConfig';

  static defaults = {
    apiBaseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o'
  };

  config: { apiBaseUrl: string; apiKey: string; model: string };

  constructor() {
    this.config = { ...LLMConfigManager.defaults };
    this.load();
  }

  load() {
    const stored = localStorage.getItem(LLMConfigManager.STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.config = { ...this.config, ...parsed };
      } catch (e) {
        console.error('Failed to parse stored LLM config:', e);
      }
    }
  }

  save(newConfig: Partial<{ apiBaseUrl: string; apiKey: string; model: string }>) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(LLMConfigManager.STORAGE_KEY, JSON.stringify(this.config));
  }

  getConfig() {
    return this.config;
  }

  isConfigured() {
    return !!this.config.apiKey;
  }
}
