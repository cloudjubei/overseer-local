/*
Live Data Types and Contracts
- Defines the shape of LiveDataService config and provider interfaces.
*/

export const FreshnessPolicy = Object.freeze({
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
});

export const AutoUpdateTrigger = Object.freeze({
  onAppLaunch: 'onAppLaunch',
  scheduled: 'scheduled', // future use (cron or HH:mm)
});

// Normalize shape for service entries read from storage or defaults
export function normalizeService(service) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    freshnessPolicy: service.freshnessPolicy || service.freshness || FreshnessPolicy.daily,
    autoUpdate: typeof service.autoUpdate === 'object'
      ? { enabled: !!service.autoUpdate.enabled, trigger: service.autoUpdate.trigger || AutoUpdateTrigger.onAppLaunch, time: service.autoUpdate.time }
      : { enabled: !!service.autoUpdate, trigger: AutoUpdateTrigger.onAppLaunch },
    lastUpdated: typeof service.lastUpdated === 'number'
      ? service.lastUpdated
      : (service.lastUpdated ? new Date(service.lastUpdated).getTime() : 0),
    config: service.config || {}, // free-form; may include url, headers, params, etc.
    isUpdating: !!service.isUpdating,
  };
}

// Interface (documentation) for providers
// A provider implementation must expose: { id, update(service, deps), getData(service, deps) }
// - id: string (matches service id for built-ins or a generic provider id for dynamic services)
// - update: performs network or internal refresh, should persist data via store if applicable
// - getData: returns current data snapshot for the service

export function computeIsFresh(service, now = Date.now()) {
  if (!service.lastUpdated) return false;
  const diffMs = now - service.lastUpdated;
  const dayMs = 24 * 60 * 60 * 1000;
  switch (service.freshnessPolicy) {
    case FreshnessPolicy.daily:
      return diffMs < dayMs;
    case FreshnessPolicy.weekly:
      return diffMs < 7 * dayMs;
    case FreshnessPolicy.monthly:
      return diffMs < 30 * dayMs; // Approximate month
    default:
      return false;
  }
}
