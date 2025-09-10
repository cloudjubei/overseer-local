import { useAppSettingsContext } from '../settings/AppSettingsContext'

// This hook is now a thin wrapper around the top-level AppSettingsContext
export function useAppSettings() {
  return useAppSettingsContext()
}
