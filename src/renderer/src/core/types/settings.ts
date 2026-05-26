// Settings types + defaults lifted to `thefactory-ui/headless/types/settings`.
// This file re-exports them so existing call sites keep their import paths,
// and patches `DEFAULT_APP_SETTINGS` with the mac-aware `Mod` key the
// headless layer can't sniff.

import { DEFAULT_APP_SETTINGS as HEADLESS_DEFAULTS, type AppSettings } from 'thefactory-ui/headless'

export {
  AVAILABLE_THEMES,
  BADGE_COLORS,
  CODE_BLOCK_THEMES,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PROJECT_SETTINGS,
  DEFAULT_SHORTCUTS,
  type AppSettings,
  type BadgeColor,
  type ChatBadgeCountMode,
  type CodeBlockTheme,
  type NotificationCategory,
  type NotificationPrefs,
  type ProjectSettings,
  type ShortcutsConfig,
  type ShortcutsModifier,
  type StoriesListSorting,
  type StoriesListStatusFilter,
  type StoriesViewMode,
  type Theme,
  type UserPreferences,
} from 'thefactory-ui/headless'

function isMacPlatform(): boolean {
  try {
    return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || '')
  } catch {
    return false
  }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ...HEADLESS_DEFAULTS,
  userPreferences: {
    ...HEADLESS_DEFAULTS.userPreferences,
    shortcutsModifier: isMacPlatform() ? 'meta' : 'ctrl',
  },
}
