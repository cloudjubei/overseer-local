export type LiveDataProviderFreshnessPolicy = 'daily' | 'weekly' | 'monthly';
export type LiveDataProviderAutoUpdateTrigger = 'onAppLaunch' | 'scheduled';

export interface LiveDataProviderAutoUpdateSettings {
  enabled: boolean;
  trigger: LiveDataProviderAutoUpdateTrigger;
  time?: number; // Unix timestamp
}

export interface LiveDataProvider<TConfig = unknown> {
  id: string;
  name: string;
  description: string;
  lastUpdated: number; // Unix timestamp
  freshnessPolicy: LiveDataProviderFreshnessPolicy;
  autoUpdate: LiveDataProviderAutoUpdateSettings;
  config: TConfig; // Service-specific configuration
}

export type LiveDataProviderStatus = LiveDataProvider & {
  isUpdating?: boolean;
  isFresh?: boolean;
};
