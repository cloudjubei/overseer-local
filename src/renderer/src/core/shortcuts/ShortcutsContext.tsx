import type { ReactNode } from 'react'
import { ShortcutsProvider as HeadlessShortcutsProvider } from 'thefactory-ui/web'
import { useAppSettings } from '../contexts/AppSettingsContext'

export { useShortcuts, type Shortcut, type ShortcutHandler, type ShortcutsApi } from 'thefactory-ui/web'

/**
 * App-side adapter: feeds the user's selected modifier from `useAppSettings`
 * into the headless `ShortcutsProvider`. Lets call sites stay
 * `<ShortcutsProvider>…</ShortcutsProvider>` without prop wiring.
 */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings()
  return (
    <HeadlessShortcutsProvider modifier={settings.userPreferences.shortcutsModifier}>
      {children}
    </HeadlessShortcutsProvider>
  )
}
