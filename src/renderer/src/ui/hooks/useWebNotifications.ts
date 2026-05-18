import { useCallback, useEffect, useState } from 'react'
import { useAppSettings } from '@core/contexts/AppSettingsContext'
import { useActiveProject } from '@core/contexts/ProjectsContext'
import { useProjectSettings } from '@core/hooks/useProjectSettings'
import { resolveTriState } from '@core/notifications/triState'
import type { NotificationPrefs } from '@core/types/settings'
import { playBeep } from '@ui/utils/beep'

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export type WebNotificationsApi = {
  permission: NotificationPermissionState
  /** Returns the new permission state after the user responds. */
  request: () => Promise<NotificationPermissionState>
  /** Posts a notification if the active settings + permission allow it. No-op otherwise. */
  notify: (
    category: keyof NotificationPrefs['categories'],
    options: { title: string; body?: string; tag?: string },
  ) => void
}

function readPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/**
 * Wraps the browser Notifications API with the user's stored preferences.
 * Suppresses notifications when the document is visible (no point pinging the
 * user about a screen they're already looking at) and respects per-category
 * toggles + display duration.
 */
export function useWebNotifications(): WebNotificationsApi {
  const { settings, setNotifications } = useAppSettings()
  const { projectId } = useActiveProject()
  const { settings: projectSettings } = useProjectSettings(projectId)
  const [permission, setPermission] = useState<NotificationPermissionState>(readPermission)

  useEffect(() => {
    setPermission(readPermission())
  }, [])

  const request = useCallback(async (): Promise<NotificationPermissionState> => {
    if (typeof Notification === 'undefined') return 'unsupported'
    const next = await Notification.requestPermission()
    setPermission(next)
    if (next !== 'granted') setNotifications({ osNotificationsEnabled: false })
    return next
  }, [setNotifications])

  const notify = useCallback<WebNotificationsApi['notify']>(
    (category, options) => {
      if (permission !== 'granted') return
      const prefs = settings.notifications
      if (!prefs.osNotificationsEnabled) return
      // Per-project tri-state override; missing falls back to the global toggle.
      const allowed = resolveTriState(
        prefs.categories[category],
        projectSettings.notifications.categories[category],
      )
      if (!allowed) return
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') return

      const n = new Notification(options.title, {
        body: options.body,
        tag: options.tag,
      })
      if (prefs.soundsEnabled) playBeep()
      const seconds = prefs.displayDurationSeconds
      if (seconds > 0) {
        window.setTimeout(() => n.close(), seconds * 1000)
      }
    },
    [permission, settings.notifications, projectSettings.notifications.categories],
  )

  return { permission, request, notify }
}
