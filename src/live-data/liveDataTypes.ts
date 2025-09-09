export type LiveDataProviderFreshnessPolicy = 'daily' | 'weekly' | 'monthly';
export type LiveDataProviderAutoUpdateTrigger = 'onAppLaunch' | 'scheduled';

export interface LiveDataProviderAutoUpdateSettings {
  enabled: boolean;
  trigger: LiveDataProviderAutoUpdateTrigger;
  time?: number; // Unix timestamp
}

export interface LiveDataProvider {
  id: string;
  name: string;
  description: string;
  lastUpdated: number; // Unix timestamp
  freshnessPolicy: LiveDataProviderFreshnessPolicy;
  autoUpdate: LiveDataProviderAutoUpdateSettings;
  config: any; // Service-specific configuration
}

export interface LiveDataProviderStatus extends LiveDataProvider {
  isUpdating?: boolean;
  isFresh?: boolean;
};
