import { LiveDataProvider, LiveDataProviderStatus } from "src/live-data/liveDataTypes"

export type LiveDataService = {
  subscribe: (callback: (statuses: LiveDataProviderStatus[]) => void) => () => void
  getStatus: () => Promise<LiveDataProviderStatus[]>
  triggerUpdate: (serviceId: string) => Promise<LiveDataProviderStatus | undefined>
  updateConfig: (serviceId: string, updates: Partial<Omit<LiveDataProvider, "id">>) => Promise<LiveDataProviderStatus>
}

export const liveDataService: LiveDataService = { ...window.liveDataService }