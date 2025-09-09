import AppStorage from '../settings/AppStorage';

// LiveDataStore persists service configs and per-service data cache.
export class LiveDataStore {
  constructor() {
    this.storage = new AppStorage('live-data');
  }

  getServices() {
    try {
      const raw = this.storage.getItem('services-config');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('[live-data] Failed to read services-config:', e);
      return null;
    }
  }

  setServices(services) {
    try {
      this.storage.setItem('services-config', JSON.stringify(services));
    } catch (e) {
      console.error('[live-data] Failed to write services-config:', e);
    }
  }

  getServiceData(serviceId) {
    try {
      const raw = this.storage.getItem(`data:${serviceId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('[live-data] Failed to read service data for', serviceId, e);
      return null;
    }
  }

  setServiceData(serviceId, data) {
    try {
      this.storage.setItem(`data:${serviceId}`, JSON.stringify(data));
    } catch (e) {
      console.error('[live-data] Failed to write service data for', serviceId, e);
    }
  }
}
