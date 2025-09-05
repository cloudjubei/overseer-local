import { NotificationCategory } from "src/types/notifications";

export type ShortcutsModifier = 'meta' | 'ctrl';

export type ShortcutsConfig = {
  commandMenu: string;      // e.g., 'Mod+K'
  newTask: string;          // e.g., 'Mod+N'
  help: string;             // e.g., 'Mod+Shift+?'
  addUiFeature: string;     // e.g., 'Mod+Shift+F'
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  userPreferences: {
    lastActiveProjectId: 'main',
    tasksViewMode: 'list',
    tasksListViewSorting: 'index_desc',
    tasksListViewStatusFilter: 'all',
    sidebarCollapsed: false,
    shortcutsModifier: navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac') ? 'meta' : 'ctrl',
    shortcuts: {
      commandMenu: 'Mod+K',
      newTask: 'Mod+N',
      help: 'Mod+Shift+?',
      addUiFeature: 'Mod+Shift+F',
    },
  },
  notificationSystemSettings: {
    osNotificationsEnabled: true,
    soundsEnabled: true,
    displayDuration: 5,
  },
}
export interface AppSettings {
  userPreferences: UserPreferences
  notificationSystemSettings: NotificationSystemSettings
}

export interface NotificationSystemSettings {
  osNotificationsEnabled: boolean;
  soundsEnabled: boolean;
  displayDuration: number;
}

export type TaskListStatusFilter = 'all' | 'not-done' | '-' | '~' | '+' | '=' | '?'

export interface UserPreferences {
  lastActiveProjectId: string;
  tasksViewMode: TaskViewMode;
  tasksListViewSorting: TaskListViewSorting;
  tasksListViewStatusFilter: TaskListStatusFilter;
  sidebarCollapsed: boolean;
  shortcutsModifier: ShortcutsModifier;
  shortcuts: ShortcutsConfig;
}
export type TaskViewMode = 'list' | 'board'
export type TaskListViewSorting = 'index_asc' | 'index_desc' | 'status_asc' | 'status_desc'


export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  notifications: { categoriesEnabled: { general: true, files: true, chat: true, tasks: true, system: true, updates: true } }
}
export interface NotificationProjectSettings {
  categoriesEnabled: Record<NotificationCategory, boolean>;
}
export interface ProjectSettings {
  notifications: NotificationProjectSettings
}
