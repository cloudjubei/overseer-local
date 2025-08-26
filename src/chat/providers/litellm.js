import { completion } from 'litellm';
import { BaseProvider } from './base';

export class LiteLLMProvider extends BaseProvider {
  async createCompletion(params) {
    return completion({
      ...params,
      api_key: this.config.apiKey,
      api_base: this.config.apiBaseUrl,
      timeout: this.config.timeout ? Math.ceil(this.config.timeout / 1000) : undefined
    });
  }
}