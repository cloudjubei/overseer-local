import { completion } from 'litellm';
import { BaseProvider } from './base';

export class LiteLLMProvider extends BaseProvider {
  constructor(config) {
    super(config);
  }
  async createCompletion(params) {
    return completion({
      messages: params.messages,
      model: params.model,
      apiKey: this.config.apiKey,
      timeout: this.config.timeout ? Math.ceil(this.config.timeout / 1000) : undefined
    });
  }
}