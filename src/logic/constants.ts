import { AppSettings, ProjectSettings } from '../types/settings'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  userPreferences: {
    lastActiveProjectId: 'main',
    storiesViewMode: 'list',
    storiesListViewSorting: 'index_desc',
    storiesListViewStatusFilter: 'all',
    showNotificationsNav: true,
    sidebarCollapsed: false,
    shortcutsModifier: navigator.userAgent.toLowerCase().includes('mac') ? 'meta' : 'ctrl',
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

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  notifications: {
    notificationsEnabled: {
      agent_runs: true,
      chat_messages: true,
      git_changes: true,
    },
    badgesEnabled: {
      agent_runs: true,
      chat_messages: true,
      git_changes: true,
    },
  },
}
