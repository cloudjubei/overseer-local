export interface LLMConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
}

export class LLMConfigManager {
  private storageKey = 'llmConfig';

  getConfig(): LLMConfig {
    const defaults: LLMConfig = {
      apiBaseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o'
    };

    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<LLMConfig>;
        return { ...defaults, ...parsed };
      } catch (e) {
        console.error('Failed to parse stored config', e);
      }
    }
    return defaults;
  }

  save(config: LLMConfig): void {
    localStorage.setItem(this.storageKey, JSON.stringify(config));
  }

  isConfigured(): boolean {
    return !!this.getConfig().apiKey;
  }
}
