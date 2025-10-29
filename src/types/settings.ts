import type { NotificationCategory } from './notifications'
import type { WebSearchApiKeys } from 'thefactory-tools'

export type ShortcutsModifier = 'meta' | 'ctrl'

export type ShortcutsConfig = {
  commandMenu: string // e.g., 'Mod+K'
  newStory: string // e.g., 'Mod+N'
  help: string // e.g., 'Mod+/'
  addUiFeature: string // e.g., 'Mod+Shift+F'
}

export interface AppSettings {
  userPreferences: UserPreferences
  notificationSystemSettings: NotificationSystemSettings
  webSearchApiKeys: WebSearchApiKeys
  database: DatabaseSettings
}

export interface NotificationSystemSettings {
  osNotificationsEnabled: boolean
  soundsEnabled: boolean
  displayDuration: number
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

export interface NotificationProjectSettings {
  categoriesEnabled: Record<NotificationCategory, boolean>
}
export interface ProjectSettings {
  notifications: NotificationProjectSettings
}
export type DatabaseSettings = {
  // Postgres connection string for thefactory-db (e.g., postgres://user:pass@host:port/db)
  connectionString?: string
}
