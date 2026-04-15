import { AppSettings, ProjectSettings } from '../types/settings'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  userPreferences: {
    lastActiveProjectId: undefined,
    storiesViewMode: 'list',
    storiesListViewSorting: 'index_desc',
    storiesListViewStatusFilter: 'all',
    sidebarCollapsed: false,
    shortcutsModifier: navigator.userAgent?.toLowerCase().includes('mac') ? 'meta' : 'ctrl',
    shortcuts: {
      commandMenu: 'Mod+K',
      newStory: 'Mod+N',
      help: 'Mod+/',
      addUiFeature: 'Mod+Shift+F',
    },
    showDiagnosticsOverlay: false,
  },
  notificationSystemSettings: {
    osNotificationsEnabled: true,
    soundsEnabled: true,
    displayDuration: 5,
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
    badgeColors: {
      agent_runs: 'blue',
      chat_messages: 'red',
      git_changes: 'orange',
    },
    chatBadgeCountMode: 'chats_with_unread',
    gitBadgeSubToggles: {
      incoming_commits: true,
      uncommitted_changes: true,
    },
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
  },
}
