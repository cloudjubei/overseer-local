import { OpenAI } from 'openai';
import { BaseProvider } from './base';

export class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.client = new OpenAI({
      baseURL: config.apiBaseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout
    });
  }

  async createCompletion(params) {
    return this.client.chat.completions.create(params);
  }
}