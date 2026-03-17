import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { notificationsService } from '@renderer/services/notificationsService'
import type {
  Notification,
  NotificationMetadata,
  NotificationCategory,
} from 'src/types/notifications'
import { settingsService } from '@renderer/services/settingsService'
import { useProjectContext } from '@renderer/contexts/ProjectContext'
import { useProjectsGroups } from '@renderer/contexts/ProjectsGroupsContext'
import { useChats } from '@renderer/contexts/chats/ChatsContext'
import { useChatThinking } from '@renderer/hooks/useChatThinking'
import { useChatUnread } from '@renderer/hooks/useChatUnread'
import { useNavigator } from '@renderer/navigation/Navigator'
import { useAppSettings } from '@renderer/contexts/AppSettingsContext'
import { NotificationSoundService } from '@renderer/services/notificationSoundService'
import { useAgents } from '@renderer/contexts/AgentsContext'
import { useGit } from '@renderer/contexts/GitContext'

export type ProjectBadgeState = {
  agent_runs: { running: number; unread: number }
  chat_messages: { unread: number; thinking: boolean }
  git_changes: {
    /** Unread feature-branch updates (branches ahead of current) */
    unread: number
    /** Commits available to pull on the current branch (behind remote) */
    incoming: number
    /** Whether the working tree has uncommitted changes */
    uncommitted: boolean
  }
}

const DEFAULT_PROJECT_BADGE_STATE: ProjectBadgeState = {
  agent_runs: { running: 0, unread: 0 },
  chat_messages: { unread: 0, thinking: false },
  git_changes: { unread: 0, incoming: 0, uncommitted: false },
}

export function useNotifications() {
  const { activeProject, projects } = useProjectContext()
  const { groups } = useProjectsGroups()
  const { chatsByProjectId } = useChats()
  
  const { thinkingCountByProject } = useChatThinking(500)
  const { unreadCountByProject } = useChatUnread()
  const { getProjectRunningCount, getCompletedUnreadCount } = useAgents()
  const { getProjectUpdatedBranchesCount, getGitDerivedBadges } = useGit()

  type CategoryPrefs = Record<NotificationCategory, boolean>
  type NotificationPrefs = { notificationsEnabled: CategoryPrefs; badgesEnabled: CategoryPrefs }
  const DEFAULT_PREFS: NotificationPrefs = {
    notificationsEnabled: { agent_runs: true, chat_messages: true, git_changes: true },
    badgesEnabled: { agent_runs: true, chat_messages: true, git_changes: true },
  }
  const [prefsByProject, setPrefsByProject] = useState<Record<string, NotificationPrefs>>({})

  const loadPrefs = useCallback(async (pid?: string) => {
    if (!pid) return
    try {
      const s = await settingsService.getProjectSettings(pid)
      const n = (s as any)?.notifications || {}
      const next: NotificationPrefs = {
        notificationsEnabled: n.notificationsEnabled || DEFAULT_PREFS.notificationsEnabled,
        badgesEnabled: n.badgesEnabled || DEFAULT_PREFS.badgesEnabled,
      }
      setPrefsByProject((prev) => ({ ...prev, [pid]: next }))
    } catch {
      setPrefsByProject((prev) => ({ ...prev, [pid]: DEFAULT_PREFS }))
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
      const key = pid || activeProject?.id
      if (!key) return true
      const p = prefsByProject[key] || DEFAULT_PREFS
      return p.notificationsEnabled[category] !== false
    },
    [activeProject?.id, prefsByProject],
  )

  const isBadgeEnabled = useCallback(
    (category: NotificationCategory, pid?: string): boolean => {
      const key = pid || activeProject?.id
      if (!key) return true
      const p = prefsByProject[key] || DEFAULT_PREFS
      return p.badgesEnabled[category] !== false
    },
    [activeProject?.id, prefsByProject],
  )

  const badgeStateByProject = useMemo(() => {
    const state: Record<string, ProjectBadgeState> = {}
    for (const p of projects) {
      const pid = p.id
      const gitDerived = getGitDerivedBadges(pid)
      state[pid] = {
        agent_runs: {
          running: getProjectRunningCount(pid),
          unread: getCompletedUnreadCount(pid),
        },
        chat_messages: {
          unread: unreadCountByProject.get(pid) ?? 0,
          thinking: (thinkingCountByProject.get(pid) ?? 0) > 0,
        },
        git_changes: {
          unread: getProjectUpdatedBranchesCount(pid),
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
    thinkingCountByProject,
    getProjectUpdatedBranchesCount,
    getGitDerivedBadges,
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
      const agg: ProjectBadgeState = {
        agent_runs: { running: 0, unread: 0 },
        chat_messages: { unread: 0, thinking: false },
        git_changes: { unread: 0, incoming: 0, uncommitted: false },
      }
      for (const pid of g.projects || []) {
        const st = badgeStateByProject[pid]
        if (!st) continue
        agg.agent_runs.running += st.agent_runs.running
        agg.agent_runs.unread += st.agent_runs.unread
        agg.chat_messages.unread += st.chat_messages.unread
        agg.chat_messages.thinking = agg.chat_messages.thinking || st.chat_messages.thinking
        agg.git_changes.unread += st.git_changes.unread
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
