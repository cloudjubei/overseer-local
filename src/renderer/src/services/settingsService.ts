import { AppSettings, ProjectSettings } from 'src/types/settings'

export type SettingsService = {
  getAppSettings: () => Promise<AppSettings>
  updateAppSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>

  subscribe: (callback: (settings: ProjectSettings) => void) => () => void
  getProjectSettings: (projectId: string) => Promise<ProjectSettings>
  updateProjectSettings: (
    projectId: string,
    updates: Partial<ProjectSettings>,
  ) => Promise<ProjectSettings>
}

// Keep a central list of subscriber callbacks
const listeners: Array<(settings: ProjectSettings) => void> = []

// Keep track of the native unsubscription function from ipcRenderer
let nativeUnsubscribe: (() => void) | null = null

// Override the subscribe function from window.settingsService
const customSubscribe = (callback: (settings: ProjectSettings) => void): (() => void) => {
  listeners.push(callback)

  // If this is the first listener, establish the native IPC subscription
  if (listeners.length === 1 && window.settingsService?.subscribe) {
    nativeUnsubscribe = window.settingsService.subscribe((settings: ProjectSettings) => {
      // Fan-out to all active local listeners
      listeners.forEach((listener) => listener(settings))
    })
  }

  // Return a cleanup function for this specific listener
  return () => {
    const idx = listeners.indexOf(callback)
    if (idx !== -1) {
      listeners.splice(idx, 1)
    }

    // If no more listeners remain, clean up the native IPC subscription
    if (listeners.length === 0 && nativeUnsubscribe) {
      nativeUnsubscribe()
      nativeUnsubscribe = null
    }
  }
}

export const settingsService: SettingsService = {
  ...window.settingsService,
  subscribe: customSubscribe,
}
