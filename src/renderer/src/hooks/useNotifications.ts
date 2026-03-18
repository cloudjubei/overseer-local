import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { notificationsService } from '@renderer/services/notificationsService'
import type {
  Notification,
  NotificationMetadata,
  NotificationCategory,
} from 'src/types/notifications'
import type { BadgeColor, ProjectSettings, NotificationSystemSettings } from 'src/types/settings'
import { settingsService } from '@renderer/services/settingsService'
import { useProjectContext } from '@renderer/contexts/ProjectContext'
import { useProjectsGroups } from '@renderer/contexts/ProjectsGroupsContext'
import { useChatThinking } from '@renderer/hooks/useChatThinking'
import { useChatUnread } from '@renderer/hooks/useChatUnread'
import { useNavigator } from '@renderer/navigation/Navigator'
import { useAppSettings } from '@renderer/contexts/AppSettingsContext'
import { NotificationSoundService } from '@renderer/services/notificationSoundService'
import { useAgents } from '@renderer/contexts/AgentsContext'
import { useGit } from '@renderer/contexts/GitContext'
import { DEFAULT_PROJECT_SETTINGS } from './useProjectSettings'

export type ProjectBadgeState = {
  agent_runs: { running: number; unread: number }
  chat_messages: { unread: number; thinking: boolean }
  git_changes: {
    /** Commits available to pull on the current branch (behind remote) */
    incoming: number
    /** Whether the working tree has uncommitted changes */
    uncommitted: boolean
  }
}

const DEFAULT_PROJECT_BADGE_STATE: ProjectBadgeState = {
  agent_runs: { running: 0, unread: 0 },
  chat_messages: { unread: 0, thinking: false },
  git_changes: { incoming: 0, uncommitted: false },
}

export function useNotifications() {
  const { activeProject, projects } = useProjectContext()
  const { groups } = useProjectsGroups()
  const { appSettings } = useAppSettings()
  const systemSettings = appSettings.notificationSystemSettings

  const { thinkingCountByProject } = useChatThinking(500)
  const { unreadCountByProject, totalUnreadCountByProject } = useChatUnread()
  const { getProjectRunningCount, getCompletedUnreadCount } = useAgents()
  const { getGitDerivedBadges } = useGit()

  const [projectPrefsByPid, setProjectPrefsByPid] = useState<
    Record<string, ProjectSettings['notifications']>
  >({})

  const loadPrefs = useCallback(async (pid?: string) => {
    if (!pid) return
    try {
      const s = await settingsService.getProjectSettings(pid)
      const n = (s as any)?.notifications || {}
      setProjectPrefsByPid((prev) => ({ ...prev, [pid]: n }))
    } catch {
      setProjectPrefsByPid((prev) => ({ ...prev, [pid]: DEFAULT_PROJECT_SETTINGS.notifications }))
    }
  }, [])

  useEffect(() => {
    if (activeProject?.id) void loadPrefs(activeProject.id)
  }, [activeProject?.id, loadPrefs])

  useEffect(() => {
    if (!projects || projects.length === 0) return
    for (const p of projects) {
      void loadPrefs(p.id)
    }
  }, [projects.map((p) => p.id).join('|'), loadPrefs])

  useEffect(() => {
    const unsub = settingsService.subscribe(() => {
      if (activeProject?.id) void loadPrefs(activeProject.id)
    })
    return () => unsub()
  }, [activeProject?.id, loadPrefs])

  const isNotificationsEnabled = useCallback(
    (category: NotificationCategory, pid?: string): boolean => {
      // Must be enabled globally AND in the project
      if (systemSettings.notificationsEnabled?.[category] === false) return false

      const key = pid || activeProject?.id
      if (!key) return true
      const p = projectPrefsByPid[key] || DEFAULT_PROJECT_SETTINGS.notifications
      return p.notificationsEnabled?.[category] !== false
    },
    [activeProject?.id, projectPrefsByPid, systemSettings.notificationsEnabled],
  )

  const isBadgeEnabled = useCallback(
    (category: NotificationCategory): boolean => {
      // Badges are purely driven by global systemSettings now
      return systemSettings.badgesEnabled?.[category] !== false
    },
    [systemSettings.badgesEnabled],
  )

  const getBadgeColor = useCallback(
    (category: NotificationCategory): BadgeColor | undefined => {
      return systemSettings.badgeColors?.[category]
    },
    [systemSettings.badgeColors],
  )

  const isGitBadgeSubToggleEnabled = useCallback(
    (subToggle: 'incoming_commits' | 'uncommitted_changes'): boolean => {
      return systemSettings.gitBadgeSubToggles?.[subToggle] !== false
    },
    [systemSettings.gitBadgeSubToggles],
  )

  const badgeStateByProject = useMemo(() => {
    const state: Record<string, ProjectBadgeState> = {}
    for (const p of projects) {
      const pid = p.id
      const gitDerived = getGitDerivedBadges(pid)
      const chatUnread =
        systemSettings.chatBadgeCountMode === 'total_messages'
          ? (totalUnreadCountByProject.get(pid) ?? 0)
          : (unreadCountByProject.get(pid) ?? 0)

      state[pid] = {
        agent_runs: {
          running: getProjectRunningCount(pid),
          unread: getCompletedUnreadCount(pid),
        },
        chat_messages: {
          unread: chatUnread,
          thinking: (thinkingCountByProject.get(pid) ?? 0) > 0,
        },
        git_changes: {
          incoming: gitDerived.incomingCommits,
          uncommitted: gitDerived.hasUncommittedChanges,
        },
      }
    }
    return state
  }, [
    projects,
    getProjectRunningCount,
    getCompletedUnreadCount,
    unreadCountByProject,
    totalUnreadCountByProject,
    thinkingCountByProject,
    getGitDerivedBadges,
    systemSettings.chatBadgeCountMode,
  ])

  const getProjectBadgeState = useCallback(
    (projectId?: string): ProjectBadgeState => {
      if (!projectId) return DEFAULT_PROJECT_BADGE_STATE
      return badgeStateByProject[projectId] || DEFAULT_PROJECT_BADGE_STATE
    },
    [badgeStateByProject],
  )

  const getGroupBadgeState = useCallback(
    (groupId: string): ProjectBadgeState => {
      const g = groups.find((x) => x.id === groupId)
      if (!g) return DEFAULT_PROJECT_BADGE_STATE
      // SCOPE groups never aggregate from member projects — they only have their own
      // group-level chat badges which are not tracked here, so return empty state.
      if (g.type === 'SCOPE') return DEFAULT_PROJECT_BADGE_STATE

      // MAIN groups aggregate badges from all member projects
      const agg: ProjectBadgeState = {
        agent_runs: { running: 0, unread: 0 },
        chat_messages: { unread: 0, thinking: false },
        git_changes: { incoming: 0, uncommitted: false },
      }

      for (const pid of g.projects || []) {
        const st = badgeStateByProject[pid]
        if (!st) continue
        agg.agent_runs.running += st.agent_runs.running
        agg.agent_runs.unread += st.agent_runs.unread
        agg.chat_messages.unread += st.chat_messages.unread
        agg.chat_messages.thinking = agg.chat_messages.thinking || st.chat_messages.thinking
        agg.git_changes.incoming += st.git_changes.incoming
        agg.git_changes.uncommitted = agg.git_changes.uncommitted || st.git_changes.uncommitted
      }
      return agg
    },
    [groups, badgeStateByProject],
  )

  const enableNotifications = useCallback(async () => {
    try {
      await notificationsService.sendOs({
        title: 'Notifications enabled',
        message: 'You will receive desktop notifications for important events.',
        soundsEnabled: false,
        displayDuration: 5,
      })
      return true
    } catch (_) {
      return false
    }
  }, [])

  // Generic helpers to mark notifications as read - kept for backward compatibility if used elsewhere,
  // but badges now use derived state so this only affects the OS level notifications service history.
  const markNotificationsByIds = useCallback(
    async (ids: string[], opts?: { projectId?: string }) => {
      const pid = opts?.projectId || activeProject?.id
      if (!pid || !ids || ids.length === 0) return
      for (const id of ids) {
        try {
          await notificationsService.markNotificationAsRead(pid, id)
        } catch (_) {}
      }
    },
    [activeProject?.id],
  )

  const markNotificationsByMetadata = useCallback(
    async (
      match: Record<string, any>,
      opts?: { category?: NotificationCategory; projectId?: string },
    ) => {
      const pid = opts?.projectId || activeProject?.id
      if (!pid) return
      try {
        const recent: Notification[] = await notificationsService.getRecentNotifications(pid)
        const targets = (recent || []).filter((n) => {
          if (n.read) return false
          if (opts?.category && n.category !== opts.category) return false
          const md = n.metadata || {}
          for (const [k, v] of Object.entries(match || {})) {
            if (md[k] !== v) return false
          }
          return true
        })
        for (const n of targets) {
          try {
            await notificationsService.markNotificationAsRead(pid, n.id)
          } catch (_) {}
        }
      } catch (_) {}
    },
    [activeProject?.id],
  )

  const markNotificationsByMetadataUntil = useCallback(
    async (
      match: Record<string, any>,
      untilTs: number,
      opts?: { category?: NotificationCategory; projectId?: string },
    ) => {
      const pid = opts?.projectId || activeProject?.id
      if (!pid) return
      try {
        const recent: Notification[] = await notificationsService.getRecentNotifications(pid)
        const targets = (recent || []).filter((n) => {
          if (n.read) return false
          if (opts?.category && n.category !== opts.category) return false
          if (typeof n.timestamp !== 'number' || n.timestamp > untilTs) return false
          const md = n.metadata || {}
          for (const [k, v] of Object.entries(match || {})) {
            if (md[k] !== v) return false
          }
          return true
        })
        for (const n of targets) {
          try {
            await notificationsService.markNotificationAsRead(pid, n.id)
          } catch (_) {}
        }
      } catch (_) {}
    },
    [activeProject?.id],
  )

  return {
    isNotificationsEnabled,
    isBadgeEnabled,
    getBadgeColor,
    isGitBadgeSubToggleEnabled,
    badgeStateByProject,
    getProjectBadgeState,
    getGroupBadgeState,
    enableNotifications,
    markNotificationsByIds,
    markNotificationsByMetadata,
    markNotificationsByMetadataUntil,
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
          } catch (_) {}
        }
      },
    )

    return unsubscribe
  }, [nav])

  return null
}

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

        const recent: Notification[] = await notificationsService.getRecentNotifications(projectId)
        if (!recent || recent.length === 0) return
        const latest = recent[0]

        const now = Date.now()
        if (lastPlayedIdRef.current === latest.id && now - lastPlayTsRef.current < 1500) return

        NotificationSoundService.play(latest.category)
        lastPlayedIdRef.current = latest.id
        lastPlayTsRef.current = now
      } catch (_) {}
    })
    return () => {
      unsubscribe?.()
    }
  }, [appSettings.notificationSystemSettings.soundsEnabled, activeProject?.id])

  useEffect(() => {
    const off = notificationsService.onOpenNotification?.(() => {
      try {
      } catch (_) {}
    })
    return () => {
      off?.()
    }
  }, [])

  return null
}
