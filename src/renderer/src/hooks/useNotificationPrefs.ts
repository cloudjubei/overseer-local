import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProjectContext } from '@renderer/contexts/ProjectContext'
import { settingsService } from '@renderer/services/settingsService'
import type { NotificationCategory } from 'src/types/notifications'

export type CategoryPrefs = Record<NotificationCategory, boolean>
export type NotificationPrefs = {
  notificationsEnabled: CategoryPrefs
  badgesEnabled: CategoryPrefs
}

const DEFAULT_PREFS: NotificationPrefs = {
  notificationsEnabled: {
    agent_runs: true,
    chat_messages: true,
    git_changes: true,
  },
  badgesEnabled: {
    agent_runs: true,
    chat_messages: true,
    git_changes: true,
  },
}

export function useNotificationPrefs(projectIdOverride?: string) {
  const { activeProjectId } = useProjectContext()
  const projectId = projectIdOverride || activeProjectId

  const [prefsByProject, setPrefsByProject] = useState<Record<string, NotificationPrefs>>({})

  const loadPrefs = useCallback(async (pid?: string) => {
    if (!pid) return
    try {
      const s = await settingsService.getProjectSettings(pid)
      const n = s.notifications || {}
      const next: NotificationPrefs = {
        notificationsEnabled: n.notificationsEnabled || DEFAULT_PREFS.notificationsEnabled,
        badgesEnabled: n.badgesEnabled || DEFAULT_PREFS.badgesEnabled,
      }
      setPrefsByProject((prev) => ({ ...prev, [pid]: next }))
    } catch {
      // Default on error
      setPrefsByProject((prev) => ({ ...prev, [pid]: DEFAULT_PREFS }))
    }
  }, [])

  useEffect(() => {
    void loadPrefs(projectId)
  }, [projectId, loadPrefs])

  useEffect(() => {
    const unsub = settingsService.subscribe(() => {
      void loadPrefs(projectId)
    })
    return () => unsub()
  }, [projectId, loadPrefs])

  const prefs = useMemo<NotificationPrefs>(() => {
    if (!projectId) return DEFAULT_PREFS
    return prefsByProject[projectId] || DEFAULT_PREFS
  }, [projectId, prefsByProject])

  const isNotificationsEnabled = useCallback(
    (category: NotificationCategory, pid?: string): boolean => {
      const key = pid || projectId
      if (!key) return true
      const p = prefsByProject[key] || DEFAULT_PREFS
      return p.notificationsEnabled[category] !== false
    },
    [projectId, prefsByProject],
  )

  const isBadgeEnabled = useCallback(
    (category: NotificationCategory, pid?: string): boolean => {
      const key = pid || projectId
      if (!key) return true
      const p = prefsByProject[key] || DEFAULT_PREFS
      return p.badgesEnabled[category] !== false
    },
    [projectId, prefsByProject],
  )

  return {
    projectId,
    notificationsEnabled: prefs.notificationsEnabled,
    badgesEnabled: prefs.badgesEnabled,
    isNotificationsEnabled,
    isBadgeEnabled,
    reload: loadPrefs,
  }
}
