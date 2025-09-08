/*
Live Data Provider Registry
- Allows registering providers and looking them up by service id.
*/

export class LiveDataRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(provider) {
    if (!provider || !provider.id) throw new Error('Provider must have an id');
    this.providers.set(provider.id, provider);
  }

  get(serviceId) {
    return this.providers.get(serviceId);
  }
}
