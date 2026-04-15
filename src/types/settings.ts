import type { NotificationCategory } from './notifications'
import type { WebSearchApiKeys } from 'thefactory-tools'

export type ShortcutsModifier = 'meta' | 'ctrl'

export type ShortcutsConfig = {
  commandMenu: string // e.g., 'Mod+K'
  newStory: string // e.g., 'Mod+N'
  help: string // e.g., 'Mod+/'
  addUiFeature: string // e.g., 'Mod+Shift+F'
}

export type BadgeColor = 'red' | 'blue' | 'green' | 'orange'

/**
 * Sub-toggles for git badge types.
 * - incoming_commits: show a badge for commits available to pull on the current branch (behind remote)
 * - uncommitted_changes: show a badge when the working tree is dirty
 */
export interface GitBadgeSubToggles {
  incoming_commits: boolean
  uncommitted_changes: boolean
}

export interface NotificationSystemSettings {
  osNotificationsEnabled: boolean
  soundsEnabled: boolean
  displayDuration: number

  // Global app controls for notification features
  notificationsEnabled: Record<NotificationCategory, boolean>
  badgesEnabled: Record<NotificationCategory, boolean>
  badgeColors: Record<NotificationCategory, BadgeColor>
  chatBadgeCountMode: 'total_messages' | 'chats_with_unread'
  gitBadgeSubToggles: GitBadgeSubToggles
}

export interface AppSettings {
  userPreferences: UserPreferences
  notificationSystemSettings: NotificationSystemSettings
  webSearchApiKeys: WebSearchApiKeys
  database: DatabaseSettings
}

export type StoryListStatusFilter = 'all' | 'not-done' | '-' | '~' | '+' | '=' | '?'

export interface UserPreferences {
  lastActiveProjectId?: string
  storiesViewMode: StoryViewMode
  storiesListViewSorting: StoryListViewSorting
  storiesListViewStatusFilter: StoryListStatusFilter
  sidebarCollapsed: boolean
  // Preferred width of the right chat sidebar (pixels)
  chatSidebarWidth?: number
  shortcutsModifier: ShortcutsModifier
  shortcuts: ShortcutsConfig

  /** Dev-only: show performance diagnostics overlay (CPU/memory/lag). */
  showDiagnosticsOverlay?: boolean
}
export type StoryViewMode = 'list' | 'board'
export type StoryListViewSorting = 'index_asc' | 'index_desc' | 'status_asc' | 'status_desc'

export interface NotificationProjectSettings {
  // Controls whether notifications of a category are created at all (requires App-level toggle to also be enabled)
  notificationsEnabled: Record<NotificationCategory, boolean>
  badgesEnabled: Record<NotificationCategory, boolean>
}

export interface ProjectSettings {
  notifications: NotificationProjectSettings
}

export type DatabaseSettings = {
  // Postgres connection string for thefactory-db (e.g., postgres://user:pass@host:port/db)
  connectionString?: string
}
