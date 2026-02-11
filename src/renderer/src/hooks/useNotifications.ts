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
import { useAgents } from '@renderer/contexts/AgentsContext'
import { useChats } from '@renderer/contexts/ChatsContext'
import { useChatThinking } from '@renderer/hooks/useChatThinking'
import { useNavigator } from '@renderer/navigation/Navigator'
import { useAppSettings } from '@renderer/contexts/AppSettingsContext'
import { NotificationSoundService } from '@renderer/services/notificationSoundService'

export type ProjectBadgeState = {
  agent_runs: { running: number; unread: number }
  chat_messages: { unread: number; thinking: boolean }
  git_changes: { unread: number }
}

const DEFAULT_PROJECT_BADGE_STATE: ProjectBadgeState = {
  agent_runs: { running: 0, unread: 0 },
  chat_messages: { unread: 0, thinking: false },
  git_changes: { unread: 0 },
}

export function useNotifications() {
  const { activeProject, projects } = useProjectContext()
  const { groups } = useProjectsGroups()
  const { runsActive, runsHistory } = useAgents()
  const { chatsByProjectId } = useChats()
  const { thinkingCountByProject } = useChatThinking(500)

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

  // Ensure per-project notification/badge preferences are available even when a project is not active.
  // This keeps sidebar badges (e.g. MAIN_PROJECT) rendering consistently regardless of which project/group is active.
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

  const runningByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of runsActive) {
      const k = r.projectId
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [runsActive])

  const [badgeStateByProject, setBadgeStateByProject] = useState<Record<string, ProjectBadgeState>>(
    {},
  )

  // Hardening: avoid pruning on cold start before chats/runs have loaded.
  // ChatsContext loads per-project; treat chats as 'loaded for project' if the key exists in chatsByProjectId.
  const chatsLoadedForProject = useCallback(
    (projectId: string): boolean => {
      try {
        return Object.prototype.hasOwnProperty.call(chatsByProjectId || {}, projectId)
      } catch {
        return false
      }
    },
    [chatsByProjectId],
  )

  // AgentsContext doesn't expose an explicit loaded flag; infer it after we observe any runs history.
  // This prevents pruning agent_run notifications prematurely on cold start.
  const runsLoadedRef = useRef(false)
  useEffect(() => {
    if ((runsHistory || []).length > 0) runsLoadedRef.current = true
  }, [runsHistory?.length])

  const validateNotification = useCallback(
    (
      n: Notification,
      projectId: string,
    ): { valid: boolean; reason?: 'missing_metadata' | 'missing_chat' | 'missing_run' } => {
      try {
        if (!n || n.read) return { valid: false, reason: 'missing_metadata' }
        const md: any = n.metadata || {}

        if (n.category === 'chat_messages') {
          const chatKey = md.chatKey as string | undefined
          if (!chatKey) return { valid: false, reason: 'missing_metadata' }

          // If chats are not loaded for this project yet, do not prune.
          if (!chatsLoadedForProject(projectId)) return { valid: true }

          const list = chatsByProjectId?.[projectId] || []
          const exists = list.some((c: any) => c.key === chatKey)
          return exists ? { valid: true } : { valid: false, reason: 'missing_chat' }
        }

        if (n.category === 'agent_runs') {
          const runId = md.runId as string | undefined
          if (!runId) return { valid: false, reason: 'missing_metadata' }

          // If runs are not loaded yet, do not prune.
          if (!runsLoadedRef.current) return { valid: true }

          const exists = (runsHistory || []).some(
            (r: any) => r.id === runId && r.projectId === projectId,
          )
          return exists ? { valid: true } : { valid: false, reason: 'missing_run' }
        }

        // git_changes and any future categories without a direct entity reference are considered valid.
        return { valid: true }
      } catch {
        // Fail closed: if we cannot validate, keep it to avoid accidentally hiding legitimate notifications.
        return { valid: true }
      }
    },
    [chatsByProjectId, runsHistory, chatsLoadedForProject],
  )

  const pruneNotifications = useCallback(async (projectId: string, toPrune: Notification[]) => {
    if (!projectId || !toPrune || toPrune.length === 0) return
    for (const n of toPrune) {
      try {
        await notificationsService.markNotificationAsRead(projectId, n.id)
      } catch (_) {}
    }
  }, [])

  const recomputeBadgeStates = useCallback(async () => {
    try {
      const unreadByProject = await Promise.all(
        projects.map(async (p) => {
          const projectId = p.id
          const unread = await notificationsService.getUnreadNotifications(projectId)

          // Only count notifications the user can still open/see.
          // Orphaned notifications (e.g. chat deleted, run deleted) are auto-pruned.
          const invalid: Notification[] = []
          const validUnread: Notification[] = []
          for (const n of unread || []) {
            const res = validateNotification(n, projectId)
            if (res.valid) validUnread.push(n)
            else invalid.push(n)
          }

          // Only prune when we have enough loaded state to make an existence decision.
          const safeToPrune = chatsLoadedForProject(projectId) && runsLoadedRef.current
          if (safeToPrune) void pruneNotifications(projectId, invalid)

          const agentRuns = validUnread.filter((n) => n.category === 'agent_runs')
          const chatMessages = validUnread.filter((n) => n.category === 'chat_messages')
          const gitChanges = validUnread.filter((n) => n.category === 'git_changes')

          return { projectId, agentRuns, chatMessages, gitChanges }
        }),
      )
      const next: Record<string, ProjectBadgeState> = {}

      for (const { projectId, agentRuns, chatMessages, gitChanges } of unreadByProject) {
        next[projectId] = {
          agent_runs: { running: runningByProject.get(projectId) ?? 0, unread: agentRuns.length },
          chat_messages: {
            unread: chatMessages.length,
            thinking: (thinkingCountByProject.get(projectId) ?? 0) > 0,
          },
          git_changes: { unread: gitChanges.length },
        }
      }
      setBadgeStateByProject(next)
    } catch (_) {}
  }, [
    projects.map((p) => p.id).join('|'),
    runningByProject,
    thinkingCountByProject,
    validateNotification,
    pruneNotifications,
    chatsLoadedForProject,
    chatsByProjectId,
  ])

  // Refresh on notifications broadcast
  useEffect(() => {
    const unsub = notificationsService.subscribe(() => {
      void recomputeBadgeStates()
    })
    return () => {
      unsub?.()
    }
  }, [recomputeBadgeStates])

  useEffect(() => {
    void recomputeBadgeStates()
  }, [recomputeBadgeStates])

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
        git_changes: { unread: 0 },
      }
      for (const pid of g.projects || []) {
        const st = badgeStateByProject[pid]
        if (!st) continue
        agg.agent_runs.running += st.agent_runs.running
        agg.agent_runs.unread += st.agent_runs.unread
        agg.chat_messages.unread += st.chat_messages.unread
        agg.chat_messages.thinking = agg.chat_messages.thinking || st.chat_messages.thinking
        agg.git_changes.unread += st.git_changes.unread
      }
      return agg
    },
    [groups.map((g) => `${g.id}:${(g.projects || []).join(',')}`).join('|'), badgeStateByProject],
  )

  // Simple helper to prompt OS notifications (best-effort)
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

  // Generic helpers to mark notifications as read
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

// Notification sounds handled here so everything is under one hood
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
        // placeholder for possible audio unlock on user interaction
      } catch (_) {}
    })
    return () => {
      off?.()
    }
  }, [])

  return null
}
