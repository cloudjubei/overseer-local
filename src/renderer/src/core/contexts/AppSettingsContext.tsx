import type { ReactNode } from 'react'
import { AppSettingsProvider as HeadlessAppSettingsProvider } from 'thefactory-ui/headless'
import { localStorageAdapter } from '../storage/localStorageAdapter'
import { DEFAULT_APP_SETTINGS } from '../types/settings'

export { useAppSettings, type AppSettingsContextValue } from 'thefactory-ui/headless'

/**
 * App-side adapter: feeds the platform-aware `DEFAULT_APP_SETTINGS` (mac
 * vs. windows/linux modifier sniff) and the `localStorage`-backed adapter
 * into the headless `AppSettingsProvider`.
 */
export function AppSettingsProvider({ children }: { children: ReactNode }) {
  return (
    <HeadlessAppSettingsProvider storage={localStorageAdapter} defaults={DEFAULT_APP_SETTINGS}>
      {children}
    </HeadlessAppSettingsProvider>
  )
}
