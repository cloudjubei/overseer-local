import { NotificationCategory } from "src/types/notifications";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  userPreferences: {
    lastActiveProjectId: 'main',
    tasksViewMode: 'list',
    tasksListViewSorting: 'index_desc',
    tasksListViewStatusFilter: 'all',
    sidebarCollapsed: false
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
