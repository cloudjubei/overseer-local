import { useEffect, useRef } from 'react'
import { notificationsService } from '@renderer/services/notificationsService'
import { NotificationSoundService } from '@renderer/services/notificationSoundService'
import { useAppSettings } from '@renderer/contexts/AppSettingsContext'
import { useProjectContext } from '@renderer/contexts/ProjectContext'
import type { Notification } from 'src/types/notifications'

// Subscribes once to notifications and plays a mapped sound per notification category/type.
// Respects appSettings.notificationSystemSettings.soundsEnabled and project categories.
export function NotificationSoundBootstrap() {
  const { appSettings } = useAppSettings()
  const { activeProject } = useProjectContext()
  const lastPlayedIdRef = useRef<string | null>(null)
  const lastPlayTsRef = useRef<number>(0)

  useEffect(() => {
    NotificationSoundService.init()
  }, [])

  useEffect(() => {
    const unsubscribe = notificationsService.subscribe(async (payload?: any) => {
      try {
        if (!appSettings.notificationSystemSettings.soundsEnabled) return

        const projectId: string | undefined = payload?.projectId ?? activeProject?.id
        if (!projectId) return

        // Fetch recent notifications and pick the latest unread or latest overall
        const recent: Notification[] = await notificationsService.getRecentNotifications(projectId)
        if (!recent || recent.length === 0) return
        const latest = recent[0]

        // Debounce repeated plays for the same ID within 1.5s window
        const now = Date.now()
        if (lastPlayedIdRef.current === latest.id && now - lastPlayTsRef.current < 1500) return

        const kind = NotificationSoundService.mapNotificationToKind(latest)
        if (!kind) return

        NotificationSoundService.play(kind)
        lastPlayedIdRef.current = latest.id
        lastPlayTsRef.current = now
      } catch (_) {
        // ignore sound errors
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [appSettings.notificationSystemSettings.soundsEnabled, activeProject?.id])

  // Also listen to OS notification open event to possibly resume audio context (optional)
  useEffect(() => {
    const off = notificationsService.onOpenNotification?.(() => {
      try {
        // no-op placeholder
      } catch (_) {}
    })
    return () => {
      off?.()
    }
  }, [])

  return null
}
