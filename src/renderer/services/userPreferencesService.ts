import { UserPreferences, TasksListViewPreferences, NotificationSystemPreferences } from "src/types/userPreferences";

export type UserPreferencesService = {
  getPreferences: () => Promise<UserPreferences>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<UserPreferences>;

  // Convenience helpers
  getLastActiveProjectId: () => Promise<string | null | undefined>;
  setLastActiveProjectId: (id: string | null) => Promise<UserPreferences>;

  getTasksViewMode: () => Promise<'list' | 'board' | undefined>;
  setTasksViewMode: (mode: 'list' | 'board') => Promise<UserPreferences>;

  getTasksListView: () => Promise<TasksListViewPreferences | undefined>;
  updateTasksListView: (updates: Partial<TasksListViewPreferences>) => Promise<UserPreferences>;

  getNotificationSystemPreferences: () => Promise<NotificationSystemPreferences | undefined>;
  updateNotificationSystemPreferences: (updates: Partial<NotificationSystemPreferences>) => Promise<UserPreferences>;
}

const baseApi = (window as any).preferencesService as {
  getPreferences: () => Promise<UserPreferences>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<UserPreferences>;
};

export const userPreferencesService: UserPreferencesService = {
  async getPreferences() {
    return baseApi.getPreferences();
  },
  async updatePreferences(updates) {
    return baseApi.updatePreferences(updates);
  },

  async getLastActiveProjectId() {
    const prefs = await baseApi.getPreferences();
    return prefs.lastActiveProjectId;
  },
  async setLastActiveProjectId(id) {
    return baseApi.updatePreferences({ lastActiveProjectId: id ?? null });
  },

  async getTasksViewMode() {
    const prefs = await baseApi.getPreferences();
    return prefs.tasksViewMode;
  },
  async setTasksViewMode(mode) {
    return baseApi.updatePreferences({ tasksViewMode: mode });
  },

  async getTasksListView() {
    const prefs = await baseApi.getPreferences();
    return prefs.tasksListView;
  },
  async updateTasksListView(updates) {
    const prefs = await baseApi.getPreferences();
    return baseApi.updatePreferences({ tasksListView: { ...(prefs.tasksListView || {}), ...updates } });
  },

  async getNotificationSystemPreferences() {
    const prefs = await baseApi.getPreferences();
    return prefs.notifications;
  },
  async updateNotificationSystemPreferences(updates) {
    const prefs = await baseApi.getPreferences();
    return baseApi.updatePreferences({ notifications: { ...(prefs.notifications || {}), ...updates } });
  }
};
