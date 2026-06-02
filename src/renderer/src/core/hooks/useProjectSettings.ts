import {
  useProjectSettings as useProjectSettingsCore,
  type ProjectSettingsApi,
} from 'thefactory-ui/headless'
import { localStorageAdapter } from 'thefactory-ui/web'

export type { ProjectSettingsApi }

/**
 * Per-project UI preferences keyed by `projectId`. Thin wrapper that binds
 * the Electron renderer's `localStorage`-backed `SyncKVStorage` adapter to
 * the shared headless `useProjectSettings` hook (single source of truth
 * across web, mobile, and desktop).
 */
export function useProjectSettings(projectId: string | undefined): ProjectSettingsApi {
  return useProjectSettingsCore(localStorageAdapter, projectId)
}
