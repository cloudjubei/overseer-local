// Settings types and defaults

export type ShortcutsModifier = 'meta' | 'ctrl'

export type ShortcutsConfig = {
  commandMenu: string
  newTask: string
  help: string
  addUiFeature: string
}

export type UserPreferences = {
  shortcutsModifier: ShortcutsModifier
  shortcuts: ShortcutsConfig
}

export type NotificationSystemSettings = {
  osNotificationsEnabled: boolean
  displayDuration: number
  soundsEnabled: boolean
}

export type GithubSettings = {
  username?: string
  email?: string
  token?: string
}

export type WebSearchApiKeys = {
  exa?: string
  serpapi?: string
  tavily?: string
}

export type DatabaseSettings = {
  // Postgres connection string for thefactory-db (e.g., postgres://user:pass@host:port/db)
  connectionString?: string
}

export type AppSettings = {
  userPreferences: UserPreferences
  notificationSystemSettings: NotificationSystemSettings
  github?: GithubSettings
  webSearchApiKeys?: WebSearchApiKeys
  database?: DatabaseSettings
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  userPreferences: {
    shortcutsModifier: 'meta',
    shortcuts: {
      commandMenu: 'Mod+K',
      newTask: 'Mod+N',
      help: 'Mod+/',
      addUiFeature: 'Mod+Shift+U',
    },
  },
  notificationSystemSettings: {
    osNotificationsEnabled: false,
    displayDuration: 5,
    soundsEnabled: true,
  },
  github: undefined,
  webSearchApiKeys: undefined,
  database: {
    connectionString: '',
  },
}
