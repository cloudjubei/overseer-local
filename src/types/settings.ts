import { NotificationCategory } from 'src/types/notifications'
import { GithubCredentials, WebSearchApiKeys } from 'thefactory-tools'

export type ShortcutsModifier = 'meta' | 'ctrl'

export type ShortcutsConfig = {
  commandMenu: string // e.g., 'Mod+K'
  newStory: string // e.g., 'Mod+N'
  help: string // e.g., 'Mod+/'
  addUiFeature: string // e.g., 'Mod+Shift+F'
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  userPreferences: {
    lastActiveProjectId: 'main',
    storiesViewMode: 'list',
    storiesListViewSorting: 'index_desc',
    storiesListViewStatusFilter: 'all',
    sidebarCollapsed: false,
    shortcutsModifier:
      navigator.platform.toLowerCase().includes('mac') ||
      navigator.userAgent.toLowerCase().includes('mac')
        ? 'meta'
        : 'ctrl',
    shortcuts: {
      commandMenu: 'Mod+K',
      newStory: 'Mod+N',
      help: 'Mod+/',
      addUiFeature: 'Mod+Shift+F',
    },
  },
  notificationSystemSettings: {
    osNotificationsEnabled: true,
    soundsEnabled: true,
    displayDuration: 5,
  },
  webSearchApiKeys: {},
  database: {},
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
  shortcutsModifier: ShortcutsModifier
  shortcuts: ShortcutsConfig
}
export type StoryViewMode = 'list' | 'board'
export type StoryListViewSorting = 'index_asc' | 'index_desc' | 'status_asc' | 'status_desc'

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  notifications: {
    categoriesEnabled: {
      general: true,
      files: true,
      chat: true,
      stories: true,
      system: true,
      updates: true,
    },
  },
}
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
