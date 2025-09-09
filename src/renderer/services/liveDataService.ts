import { LiveDataProvider, LiveDataProviderStatus } from "src/live-data/LiveDataTypes"

export type LiveDataService = {
  subscribe: (callback: (statuses: LiveDataProviderStatus[]) => void) => () => void
  getStatus: () => Promise<LiveDataProviderStatus[]>
  triggerUpdate: (serviceId: string) => Promise<LiveDataProviderStatus | undefined>
  updateConfig: (serviceId: string, updates: Partial<Omit<LiveDataProvider, "id">>) => Promise<LiveDataProviderStatus>
  getData: (serviceId: string) => Promise<any>
  addService: (service: LiveDataProvider) => Promise<LiveDataProviderStatus>
  removeService: (serviceId: string) => Promise<boolean>
}

export const liveDataService: LiveDataService = { ...window.liveDataService }