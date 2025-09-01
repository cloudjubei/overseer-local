import type { UserPreferences, NotificationSystemPreferences, TasksListViewPreferences } from 'src/types/userPreferences'

export type UserPreferencesService = {
  getPreferences: () => Promise<UserPreferences>
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<UserPreferences>

  // Convenience getters/setters
  getLastActiveProjectId: () => Promise<string | null>
  setLastActiveProjectId: (projectId: string | null) => Promise<UserPreferences>

  getTasksViewMode: () => Promise<'list' | 'board'>
  setTasksViewMode: (mode: 'list' | 'board') => Promise<UserPreferences>

  getTasksListViewPreferences: () => Promise<TasksListViewPreferences>
  updateTasksListViewPreferences: (updates: Partial<TasksListViewPreferences>) => Promise<UserPreferences>

  getNotificationSystemPreferences: () => Promise<NotificationSystemPreferences>
  updateNotificationSystemPreferences: (updates: Partial<NotificationSystemPreferences>) => Promise<UserPreferences>
}

const base = window.preferencesService as { getPreferences: () => Promise<UserPreferences>; updatePreferences: (updates: Partial<UserPreferences>) => Promise<UserPreferences> }

export const userPreferencesService: UserPreferencesService = {
  async getPreferences() {
    return base.getPreferences()
  },
  async updatePreferences(updates) {
    return base.updatePreferences(updates)
  },

  async getLastActiveProjectId() {
    const prefs = await base.getPreferences()
    // Normalize undefined to null for consumers
    return prefs.lastActiveProjectId ?? null
  },
  async setLastActiveProjectId(projectId) {
    return base.updatePreferences({ lastActiveProjectId: projectId })
  },

  async getTasksViewMode() {
    const prefs = await base.getPreferences()
    return prefs.tasksViewMode ?? 'list'
  },
  async setTasksViewMode(mode) {
    return base.updatePreferences({ tasksViewMode: mode })
  },

  async getTasksListViewPreferences() {
    const prefs = await base.getPreferences()
    return prefs.tasksListView ?? { sortBy: 'order', sortDirection: 'asc' }
  },
  async updateTasksListViewPreferences(updates) {
    const prefs = await base.getPreferences()
    const current = prefs.tasksListView ?? { sortBy: 'order', sortDirection: 'asc' }
    return base.updatePreferences({ tasksListView: { ...current, ...updates } })
  },

  async getNotificationSystemPreferences() {
    const prefs = await base.getPreferences()
    return prefs.notifications ?? { osNotificationsEnabled: true, soundsEnabled: true, displayDuration: 5 }
  },
  async updateNotificationSystemPreferences(updates) {
    const prefs = await base.getPreferences()
    const current = prefs.notifications ?? { osNotificationsEnabled: true, soundsEnabled: true, displayDuration: 5 }
    return base.updatePreferences({ notifications: { ...current, ...(updates || {}) } })
  },
}
