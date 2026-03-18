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
  // Controls whether notifications of a category are created at all
  notificationsEnabled: Record<NotificationCategory, boolean>
  // Controls whether badges for a category are shown in the UI
  badgesEnabled: Record<NotificationCategory, boolean>
  // Badge colors for each category
  badgeColors?: Record<NotificationCategory, BadgeColor>
  // Chat badge counting mode: counts total unread messages vs number of chats with unread messages
  chatBadgeCountMode?: 'total_messages' | 'chats_with_unread'
  // Fine-grained sub-toggles for git badges (only applies when badgesEnabled.git_changes is true)
  gitBadgeSubToggles?: GitBadgeSubToggles
}

export interface AppSettings {
  userPreferences: UserPreferences
  notificationSystemSettings: NotificationSystemSettings
  webSearchApiKeys: WebSearchApiKeys
  database: DatabaseSettings
}

export type StoryListStatusFilter = 'all' | 'not-done' | '-' | '~' | '+' | '=' | '?'

export interface UserPreferences {
  lastActiveProjectId: string
  storiesViewMode: StoryViewMode
  storiesListViewSorting: StoryListViewSorting
  storiesListViewStatusFilter: StoryListStatusFilter
  sidebarCollapsed: boolean
  // Preferred width of the right chat sidebar (pixels)
  chatSidebarWidth?: number
  shortcutsModifier: ShortcutsModifier
  shortcuts: ShortcutsConfig
}

export type StoryViewMode = 'list' | 'board'
export type StoryListViewSorting = 'index_asc' | 'index_desc' | 'status_asc' | 'status_desc'

export interface ProjectSettings {
  // Empty, can be extended in the future
}

export type DatabaseSettings = {
  // Postgres connection string for thefactory-db (e.g., postgres://user:pass@host:port/db)
  connectionString?: string
}
