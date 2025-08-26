import { completion } from 'litellm';
import { BaseProvider } from './base';

export class LiteLLMProvider extends BaseProvider {
  async createCompletion(params) {
    return completion({
      ...params,
      timeout: this.config.timeout ? Math.ceil(this.config.timeout / 1000) : undefined
    });
  }
}