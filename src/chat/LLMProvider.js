import { OpenAI } from 'openai';

export class LLMProvider {
  constructor(config) {
    this.client = new OpenAI({
      baseURL: config.apiBaseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout,
    });
  }

  async createCompletion(params) {
    // Use OpenAI-compatible Chat Completions API
    // Works with OpenAI, X.ai (grok), OpenRouter, LiteLLM proxy, LM Studio, etc.
    return this.client.chat.completions.create(params);
  }

  async listModels() {
    try {
      const res = await this.client.models.list();
      // Some third-party APIs may not support /models
      if (!res || !Array.isArray(res.data)) return [];
      return res.data.map((m) => m.id);
    } catch (err) {
      // Gracefully degrade when provider doesn't support models.list
      return [];
    }
  }
}
