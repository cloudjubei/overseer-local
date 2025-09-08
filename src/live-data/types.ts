export type LiveDataServiceFreshnessPolicy = 'daily' | 'weekly' | 'monthly';
export type LiveDataServiceAutoUpdateTrigger = 'onAppLaunch' | 'scheduled';

export interface LiveDataServiceAutoUpdateSettings {
  enabled: boolean;
  trigger: LiveDataServiceAutoUpdateTrigger;
}

export interface LiveDataService<TConfig = unknown> {
  id: string;
  name: string;
  description: string;
  lastUpdated: number; // Unix timestamp
  freshnessPolicy: LiveDataServiceFreshnessPolicy;
  autoUpdate: LiveDataServiceAutoUpdateSettings;
  config: TConfig; // Service-specific configuration
}
