import { OpenAI } from 'openai';
import { BaseProvider } from './base';

export class LMStudioProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.client = new OpenAI({
      baseURL: config.apiBaseUrl || 'http://localhost:1234/v1',
      apiKey: config.apiKey || 'not-needed',
      timeout: config.timeout,
      dangerouslyAllowBrowser: true // Since local, but in Electron main it's fine
    });
  }

  async createCompletion(params) {
    return this.client.chat.completions.create(params);
  }

  async listModels() {
    try {
      const response = await this.client.models.list();
      return response.data.map(model => model.id);
    } catch (error) {
      throw new Error('Failed to list models: ' + error.message);
    }
  }
}