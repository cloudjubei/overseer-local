import { useCallback, useMemo } from 'react'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { getChatContextKey } from '../chats/chatKey'
import { useAppSettings } from 'thefactory-ui/headless'
import { useChats } from 'thefactory-ui/headless'
import { useGit } from 'thefactory-ui/headless'
import { useActiveProject } from 'thefactory-ui/headless'
import { useTests } from 'thefactory-ui/headless'
import { useProjectSettingsConnected as useProjectSettings } from 'thefactory-ui/web'
import {
  aggregateGroupBadgeState,
  EMPTY_BADGE_STATE,
  isChatUnread,
  markSeen,
  resolveTriState,
  useBadgeCountsCore,
  type BadgeChatInput,
  type BadgeCounts,
  type BadgeState,
} from 'thefactory-ui/headless'
import { readChatsSeen, useChatsSeen, writeChatsSeen } from 'thefactory-ui/web'

export type { BadgeCounts }

export type UseBadgeCountsApi = {
  /** Active-project / global counts (single source for sidebar header + favicon). */
  counts: BadgeCounts
  /** Mark a chat as read up to its latest message. */
  markChatSeen: (ctx: ChatContext) => void
  /** Per-project breakdown for sidebar project rows. Filtering respects
   *  the same `badgesEnabled` toggles `counts` uses. Git + tests are scoped
   *  to the ACTIVE project (those contexts only track the active one), so
   *  non-active projects report zero on those channels. */
  getProjectBadgeState: (projectId: string) => BadgeState
  /** Group badge state — member projects rolled up via the shared
   *  `aggregateGroupBadgeState`, plus the group's own chat unread. */
  getGroupBadgeState: (groupId: string, memberProjectIds: ReadonlyArray<string>) => BadgeState
}

function latestMessageAt(
  messages: { completedAt?: string; startedAt?: string }[],
): string | undefined {
  if (messages.length === 0) return undefined
  const last = messages[messages.length - 1]
  return last.completedAt ?? last.startedAt
}

/**
 * Single source of truth for sidebar / favicon badge counts in the web app.
 * Pulls inputs from web's contexts and feeds them into the shared headless
 * `useBadgeCountsCore` for the actual count + thinking + git arithmetic —
 * keeps the math identical to desktop's `useNotifications` and ready for
 * the upcoming RN client.
 */
export function useBadgeCounts(): UseBadgeCountsApi {
  const { settings } = useAppSettings()
  const prefs = settings.notifications
  const { projectId: activeProjectId } = useActiveProject()
  const { settings: projectSettings } = useProjectSettings(activeProjectId)
  const projectOverride = projectSettings.notifications.categories
  const { chats, getChatLiveState } = useChats()
  const { status, branches } = useGit()
  const { lastRun } = useTests()

  // Subscribes to the singleton chats-seen store via useSyncExternalStore —
  // no per-hook state, no window-event listeners here. Multiple
  // useBadgeCounts instances share the same source of truth and re-render
  // in lockstep when any consumer marks a chat seen, without ever firing
  // setState during another component's render.
  const seen = useChatsSeen()

  const markChatSeen = useCallback((ctx: ChatContext) => {
    const key = getChatContextKey(ctx)
    const ts = new Date().toISOString()
    const next = markSeen(readChatsSeen(), key, ts)
    writeChatsSeen(next)
  }, [])

  // Annotate every chat with its derived unread + thinking state. Used twice:
  // once for the global `counts` (across all chats), and once filtered by
  // project for `getProjectBadgeState`.
  type AnnotatedChat = BadgeChatInput & { projectId?: string; groupId?: string }

  const annotatedChats: AnnotatedChat[] = useMemo(() => {
    return chats.map((chat) => {
      const messages = chat.messages ?? []
      const at = latestMessageAt(messages)
      const key = getChatContextKey(chat.context)
      let unreadMessages = 0
      if (isChatUnread(seen, key, at)) {
        const since = seen[key]
        if (since) {
          for (const m of messages) {
            const ts = m.completedAt ?? m.startedAt
            if (ts && ts > since) unreadMessages += 1
          }
        } else {
          unreadMessages = messages.length
        }
      }
      return {
        unreadMessages,
        isThinking: getChatLiveState(chat.context).isSending,
        projectId: chat.context.projectId,
        groupId: chat.context.groupId,
      }
    })
  }, [chats, seen, getChatLiveState])

  // The top-level `counts` represents the ACTIVE project's badge state
  // (drives the per-tab nav badges and the favicon). Use only the active
  // project's annotated chats — feeding the global list here double-counts
  // unread chats from every other project. Per-project breakdowns for the
  // sidebar project rows go through `getProjectBadgeState` below.
  const activeProjectChats = useMemo(
    () =>
      activeProjectId
        ? annotatedChats.filter((c) => c.projectId === activeProjectId)
        : [],
    [annotatedChats, activeProjectId],
  )

  const counts = useBadgeCountsCore({
    chats: activeProjectChats,
    git: status
      ? {
          uncommittedFileCount:
            status.staged.length + status.unstaged.length + status.untracked.length,
          incomingCommitCount: branches.reduce(
            (sum, b) => sum + (b.current && b.behind ? b.behind : 0),
            0,
          ),
        }
      : undefined,
    failingTests: lastRun?.summary.failed,
    enabled: {
      chat: resolveTriState(prefs.badgesEnabled.chat, projectOverride.chat),
      git: resolveTriState(prefs.badgesEnabled.git, projectOverride.git),
      tests: resolveTriState(prefs.badgesEnabled.tests, projectOverride.tests),
    },
    gitSubToggles: {
      incoming_commits: prefs.gitBadgeSubToggles.incoming_commits,
      uncommitted_changes: prefs.gitBadgeSubToggles.uncommitted_changes,
    },
    chatBadgeCountMode: prefs.chatBadgeCountMode,
  })

  // Pre-bucket annotated chats by projectId / groupId so `getProjectBadgeState`
  // and `getGroupBadgeState` are O(1) amortised. Empty buckets yield no rows.
  const chatsByProjectId = useMemo(() => {
    const out = new Map<string, AnnotatedChat[]>()
    for (const c of annotatedChats) {
      if (!c.projectId) continue
      const bucket = out.get(c.projectId) ?? []
      bucket.push(c)
      out.set(c.projectId, bucket)
    }
    return out
  }, [annotatedChats])

  const chatsByGroupId = useMemo(() => {
    const out = new Map<string, AnnotatedChat[]>()
    for (const c of annotatedChats) {
      if (!c.groupId) continue
      const bucket = out.get(c.groupId) ?? []
      bucket.push(c)
      out.set(c.groupId, bucket)
    }
    return out
  }, [annotatedChats])

  const chatEnabled = prefs.badgesEnabled.chat !== false
  const chatBadgeFor = useCallback(
    (list: AnnotatedChat[]): { unread: number; thinking: boolean } => {
      if (!chatEnabled) return { unread: 0, thinking: false }
      let chatsWithUnread = 0
      let totalUnread = 0
      let anyThinking = false
      for (const c of list) {
        if (c.unreadMessages > 0) {
          chatsWithUnread += 1
          totalUnread += c.unreadMessages
        }
        if (c.isThinking) anyThinking = true
      }
      const unread = prefs.chatBadgeCountMode === 'total_messages' ? totalUnread : chatsWithUnread
      return { unread, thinking: anyThinking }
    },
    [chatEnabled, prefs.chatBadgeCountMode],
  )

  const getProjectBadgeState = useCallback(
    (projectId: string): BadgeState => {
      if (!projectId) return EMPTY_BADGE_STATE

      const chat = chatBadgeFor(chatsByProjectId.get(projectId) ?? [])

      // Git + tests on web only track the active project; other projects
      // report 0 (parity with desktop, which also reports 0 for projects
      // whose status hasn't been polled yet).
      const isActive = projectId === activeProjectId
      const gitEnabled = prefs.badgesEnabled.git !== false
      const incoming =
        isActive && gitEnabled && prefs.gitBadgeSubToggles.incoming_commits !== false
          ? branches.reduce((sum, b) => sum + (b.current && b.behind ? b.behind : 0), 0)
          : 0
      const uncommitted =
        isActive && gitEnabled && prefs.gitBadgeSubToggles.uncommitted_changes !== false && status
          ? status.staged.length + status.unstaged.length + status.untracked.length
          : 0

      const testsEnabled = prefs.badgesEnabled.tests !== false
      const failingTests = isActive && testsEnabled ? (lastRun?.summary.failed ?? 0) : 0

      return {
        chat_messages: { unread: chat.unread, thinking: chat.thinking },
        git: { incoming, uncommitted },
        tests: { failing: failingTests },
      }
    },
    [
      chatBadgeFor,
      chatsByProjectId,
      activeProjectId,
      branches,
      status,
      lastRun,
      prefs.badgesEnabled,
      prefs.gitBadgeSubToggles,
    ],
  )

  const getGroupBadgeState = useCallback(
    (groupId: string, memberProjectIds: ReadonlyArray<string>): BadgeState => {
      const byProject: Record<string, BadgeState> = {}
      for (const pid of memberProjectIds) byProject[pid] = getProjectBadgeState(pid)
      const agg = aggregateGroupBadgeState(memberProjectIds, byProject)
      // Fold in the group's own GROUP / GROUP_TOPIC chats.
      const groupChat = chatBadgeFor(chatsByGroupId.get(groupId) ?? [])
      agg.chat_messages.unread += groupChat.unread
      agg.chat_messages.thinking = agg.chat_messages.thinking || groupChat.thinking
      return agg
    },
    [getProjectBadgeState, chatsByGroupId, chatBadgeFor],
  )

  return { counts, markChatSeen, getProjectBadgeState, getGroupBadgeState }
}
