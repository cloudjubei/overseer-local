export interface TasksListViewPreferences {
  sortBy: string;
  sortDirection: 'asc' | 'desc';
}

export interface NotificationSystemPreferences {
  osNotificationsEnabled: boolean;
  soundsEnabled: boolean;
  displayDuration: number;
}

export interface UserPreferences {
  lastActiveProjectId?: string;
  tasksViewMode?: 'list' | 'board';
  tasksListView?: TasksListViewPreferences;
  notifications?: NotificationSystemPreferences;
}
