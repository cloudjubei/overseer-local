/**
 * Client-side-only settings types. Kept local to the web app because these
 * values live in `localStorage`, not on the backend. Extend conservatively —
 * only add fields when a real screen needs them.
 */

export type Theme = 'light' | 'dark' | 'system'

export const AVAILABLE_THEMES: readonly Theme[] = ['light', 'dark', 'system'] as const

export type ShortcutsModifier = 'meta' | 'ctrl'

export type ShortcutsConfig = {
  commandMenu: string
  newStory: string
  help: string
  addUiFeature: string
}

export const DEFAULT_SHORTCUTS: ShortcutsConfig = {
  commandMenu: 'Mod+K',
  newStory: 'Mod+N',
  help: 'Mod+/',
  addUiFeature: 'Mod+Shift+F',
}

import type { StoryListSorting, StoryStatus } from 'thefactory-ui/web'

export type StoriesViewMode = 'list' | 'board'
/** Re-export of the package's sort union, kept as a local alias so existing
 *  settings shapes don't reference `thefactory-ui` types directly. */
export type StoriesListSorting = StoryListSorting
export type StoriesListStatusFilter = 'all' | 'not-done' | StoryStatus

export type CodeBlockTheme = 'light' | 'dark'
export const CODE_BLOCK_THEMES: readonly CodeBlockTheme[] = ['light', 'dark'] as const

export type UserPreferences = {
  /** Last project the user was viewing; used to restore selection on boot. */
  lastActiveProjectId?: string
  /** Whether the left navigation is collapsed. */
  sidebarCollapsed?: boolean
  /** Which physical key `Mod` resolves to (⌘ on macOS, Ctrl elsewhere by default). */
  shortcutsModifier: ShortcutsModifier
  /** Per-action keyboard shortcut combos, customisable in Settings. */
  shortcuts: ShortcutsConfig
  /** Stories list display mode. */
  storiesViewMode: StoriesViewMode
  /** Stories list ordering. */
  storiesListViewSorting: StoriesListSorting
  /** Stories list status filter. `all` shows everything; `not-done` hides done items. */
  storiesListViewStatusFilter: StoriesListStatusFilter
  /** Syntax-highlight theme for shared `<Code>` blocks. */
  codeBlockTheme: CodeBlockTheme
}

export type NotificationCategory = 'chat' | 'tests' | 'git' | 'agent_runs'

export type BadgeColor = 'red' | 'blue' | 'green' | 'orange'

export const BADGE_COLORS: readonly BadgeColor[] = ['red', 'blue', 'green', 'orange'] as const

export type ChatBadgeCountMode = 'chats_with_unread' | 'total_messages'

export type NotificationPrefs = {
  /** Show OS notifications when the tab is hidden. Requires user permission. */
  osNotificationsEnabled: boolean
  /** Per-category enablement; missing categories default to true. */
  categories: Record<NotificationCategory, boolean>
  /** Per-category badge enablement (sidebar / favicon dots). */
  badgesEnabled: Record<NotificationCategory, boolean>
  /** Per-category badge colour. */
  badgeColors: Record<NotificationCategory, BadgeColor>
  /** Whether chat badges count chats with unread messages or total unread messages. */
  chatBadgeCountMode: ChatBadgeCountMode
  /** Sub-toggles for the `git` category. */
  gitBadgeSubToggles: { incoming_commits: boolean; uncommitted_changes: boolean }
  /** Auto-dismiss after this many seconds. `0` means persistent. */
  displayDurationSeconds: 3 | 5 | 10 | 0
  /** Whether to play a short sound on notify. */
  soundsEnabled: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  osNotificationsEnabled: false,
  categories: { chat: true, tests: true, git: true, agent_runs: true },
  badgesEnabled: { chat: true, tests: true, git: true, agent_runs: true },
  badgeColors: { chat: 'blue', tests: 'green', git: 'orange', agent_runs: 'red' },
  chatBadgeCountMode: 'chats_with_unread',
  gitBadgeSubToggles: { incoming_commits: true, uncommitted_changes: true },
  displayDurationSeconds: 5,
  soundsEnabled: false,
}

export type AppSettings = {
  /** "system" follows the OS via `prefers-color-scheme`. */
  theme: Theme
  userPreferences: UserPreferences
  notifications: NotificationPrefs
}

const isMacPlatform = (): boolean => {
  try {
    return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || '')
  } catch {
    return false
  }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  userPreferences: {
    sidebarCollapsed: false,
    shortcutsModifier: isMacPlatform() ? 'meta' : 'ctrl',
    shortcuts: DEFAULT_SHORTCUTS,
    storiesViewMode: 'list',
    storiesListViewSorting: 'index_asc',
    storiesListViewStatusFilter: 'all',
    codeBlockTheme: 'light',
  },
  notifications: DEFAULT_NOTIFICATION_PREFS,
}

export type ProjectSettings = {
  notifications: {
    /** Per-category enablement scoped to one project. Missing keys fall through to the global default (true). */
    categories: Partial<NotificationPrefs['categories']>
  }
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  notifications: { categories: {} },
}
