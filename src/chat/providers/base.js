export class BaseProvider {
  constructor(config) {
    this.config = config;
  }

  async createCompletion(params) {
    throw new Error('Not implemented');
  }
}