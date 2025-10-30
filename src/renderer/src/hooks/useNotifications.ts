import { useState, useEffect, useCallback } from 'react'
import { notificationsService } from '@renderer/services/notificationsService'
import type { Notification, NotificationMetadata } from 'src/types/notifications'
import { useProjectContext } from '@renderer/contexts/ProjectContext'
import { useNavigator } from '@renderer/navigation/Navigator'

export function useNotifications() {
  const { activeProject } = useProjectContext()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)

  const updateCurrentProjectNotifications = useCallback(async () => {
    if (activeProject) {
      setNotifications(await notificationsService.getRecentNotifications(activeProject.id))
      setUnreadCount(await notificationsService.getUnreadNotificationsCount(activeProject.id))
    }
  }, [activeProject?.id])

  // Subscribe to notifications changes; re-subscribe when active project changes
  useEffect(() => {
    // Initial fetch for current project
    updateCurrentProjectNotifications()

    const unsubscribe = notificationsService.subscribe((payload?: any) => {
      // Optionally ignore updates for other projects
      if (activeProject && payload?.projectId && payload.projectId !== activeProject.id) return
      updateCurrentProjectNotifications()
    })

    return () => {
      unsubscribe()
    }
  }, [activeProject?.id, updateCurrentProjectNotifications])

  // Also refresh when activeProject changes (covers cases without a broadcast)
  useEffect(() => {
    updateCurrentProjectNotifications()
  }, [activeProject?.id, updateCurrentProjectNotifications])

  // When a notification is opened/clicked, navigate with deep-link support
  useEffect(() => {
    const off =
      notificationsService.onOpenNotification((metadata) => {
        try {
          const runId = metadata.runId
          if (runId) {
            window.location.hash = `agents/run/${runId}`
            return
          }
          if (metadata?.actionUrl && typeof metadata.actionUrl === 'string') {
            window.location.hash = metadata.actionUrl
            return
          }
        } catch (_) {
          // no-op
        }
      }) ?? (() => {})
    return () => off()
  }, [])

  const markAsRead = async (id: string) => {
    if (activeProject) {
      await notificationsService.markNotificationAsRead(activeProject.id, id)
      await updateCurrentProjectNotifications()
    }
  }

  const markAllAsRead = async () => {
    if (activeProject) {
      await notificationsService.markAllNotificationsAsRead(activeProject.id)
      await updateCurrentProjectNotifications()
    }
  }

  const clearAll = async () => {
    if (activeProject) {
      await notificationsService.deleteAllNotifications(activeProject.id)
      await updateCurrentProjectNotifications()
    }
  }

  const enableNotifications = async () => {
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
  }

  return {
    enableNotifications,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  }
}

export function NotificationClickHandler() {
  const nav = useNavigator()

  useEffect(() => {
    const unsubscribe = window.notificationsService.onOpenNotification(
      (metadata: NotificationMetadata) => {
        if (metadata.storyId) {
          nav.navigateStoryDetails(metadata.storyId, metadata.featureId)
        } else if (metadata.chatId) {
          nav.navigateView('Chat')
        } else if (metadata.documentPath) {
          nav.navigateView('Files')
        } else if (metadata.actionUrl) {
          try {
            if (typeof metadata.actionUrl === 'string') {
              window.location.hash = metadata.actionUrl
            }
          } catch (_) {
            // ignore
          }
        }
      },
    )

    return unsubscribe
  }, [nav])

  return null
}
