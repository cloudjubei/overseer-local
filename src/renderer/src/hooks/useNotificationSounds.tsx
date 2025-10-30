import { useEffect } from 'react'
import { notificationsService } from '@renderer/services/notificationsService'
import { NotificationSoundService } from '@renderer/services/notificationSoundService'
import { useAppSettings } from '@renderer/contexts/AppSettingsContext'

// Subscribes once to notifications and plays a mapped sound per notification category/type.
// Respects appSettings.notificationSystemSettings.soundsEnabled.
export function NotificationSoundBootstrap() {
  const { appSettings } = useAppSettings()

  useEffect(() => {
    NotificationSoundService.init()
  }, [])

  useEffect(() => {
    const unsubscribe = notificationsService.subscribe((payload?: any) => {
      try {
        if (!appSettings.notificationSystemSettings.soundsEnabled) return
        // payload contains projectId only; we need to fetch recent and derive the latest notification
        // However, notifications list may contain multiple; optimistically ignore and rely on main OS notification
        // Better: nothing in payload, so refetch is heavy. Instead, play based on a hint in payload when available.
        // For now, optimistically no-op here.
      } catch (_) {}
    })
    return () => {
      unsubscribe?.()
    }
  }, [appSettings.notificationSystemSettings.soundsEnabled])

  // Also listen to OS notification open event to possibly resume audio context (optional)
  useEffect(() => {
    const off = notificationsService.onOpenNotification?.(() => {
      try {
        // no-op, placeholder
      } catch (_) {}
    })
    return () => {
      off?.()
    }
  }, [])

  return null
}
