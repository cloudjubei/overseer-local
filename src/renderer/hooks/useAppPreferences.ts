import { useEffect, useState, useCallback } from 'react'
import type { UserPreferences, NotificationSystemPreferences, TasksListViewPreferences } from 'src/types/userPreferences'
import { userPreferencesService } from '../services/userPreferencesService'
import { notificationsService } from '../services/notificationsService'

const DEFAULT_PREFERENCES: UserPreferences = {
  lastActiveProjectId: null,
  tasksViewMode: 'list',
  tasksListView: { sortBy: 'order', sortDirection: 'asc' },
  notifications: { osNotificationsEnabled: true, soundsEnabled: true, displayDuration: 5 },
}

export function useAppPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const prefs = await userPreferencesService.getPreferences()
      if (mounted) setPreferences({ ...DEFAULT_PREFERENCES, ...prefs })
    })()
    return () => { mounted = false }
  }, [])

  const update = useCallback(async (updates: Partial<UserPreferences>) => {
    const next = await userPreferencesService.updatePreferences(updates)
    setPreferences({ ...DEFAULT_PREFERENCES, ...next })
    return next
  }, [])

  // Granular helpers
  const setLastActiveProjectId = useCallback(async (projectId: string | null) => {
    const next = await userPreferencesService.setLastActiveProjectId(projectId)
    setPreferences({ ...DEFAULT_PREFERENCES, ...next })
    return next
  }, [])

  const setTasksViewMode = useCallback(async (mode: 'list' | 'board') => {
    const next = await userPreferencesService.setTasksViewMode(mode)
    setPreferences({ ...DEFAULT_PREFERENCES, ...next })
    return next
  }, [])

  const updateTasksListView = useCallback(async (updates: Partial<TasksListViewPreferences>) => {
    const next = await userPreferencesService.updateTasksListViewPreferences(updates)
    setPreferences({ ...DEFAULT_PREFERENCES, ...next })
    return next
  }, [])

  const updateNotificationSystemPreferences = useCallback(async (updates: Partial<NotificationSystemPreferences>) => {
    const next = await userPreferencesService.updateNotificationSystemPreferences(updates)
    setPreferences({ ...DEFAULT_PREFERENCES, ...next })
    return next
  }, [])

  const sendTestNotification = useCallback(async () => {
    try {
      const result = await notificationsService.sendOs({
        title: 'Notifications Enabled',
        message: 'You will now receive desktop notifications for important events.',
        soundsEnabled: false,
        displayDuration: 5,
      })
      return (result as any).ok ?? (result as any).success ?? false
    } catch (_) {
      return false
    }
  }, [])

  return {
    preferences,
    update,
    // Getters
    lastActiveProjectId: preferences.lastActiveProjectId ?? null,
    tasksViewMode: preferences.tasksViewMode ?? 'list',
    tasksListView: preferences.tasksListView ?? { sortBy: 'order', sortDirection: 'asc' },
    notificationSystem: preferences.notifications ?? { osNotificationsEnabled: true, soundsEnabled: true, displayDuration: 5 },
    // Setters
    setLastActiveProjectId,
    setTasksViewMode,
    updateTasksListView,
    updateNotificationSystemPreferences,
    sendTestNotification,
  }
}
