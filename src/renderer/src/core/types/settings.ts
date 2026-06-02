// Settings types + constants live in `thefactory-ui/headless/types/settings`.
// This file re-exports them so existing call sites keep their import paths.
// The mac-aware `DEFAULT_APP_SETTINGS` patch now lives with the browser
// binding in `thefactory-ui/web`'s `AppSettingsProviderConnected`.

export {
  AVAILABLE_THEMES,
  BADGE_COLOR_CATEGORIES,
  BADGE_COLORS,
  CODE_BLOCK_THEMES,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PROJECT_SETTINGS,
  DEFAULT_SHORTCUTS,
  isBadgeColorCategory,
  type AppSettings,
  type BadgeColor,
  type BadgeColorCategory,
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
