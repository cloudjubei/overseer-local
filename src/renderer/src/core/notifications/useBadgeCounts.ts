import { useCallback, useMemo } from 'react'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { getChatContextKey } from '../chats/chatKey'
import { isAgentRunChatContext, usePendingAsksByChat } from 'thefactory-ui/headless'
import { useAppSettings } from 'thefactory-ui/headless'
import { useChats } from 'thefactory-ui/headless'
import { useGit } from 'thefactory-ui/headless'
import { useActiveProject } from 'thefactory-ui/headless'
import { useProjectActivities } from 'thefactory-ui/headless'
import { processTallyByProject, useProcessRuns } from 'thefactory-ui/headless'
import { useTests } from 'thefactory-ui/headless'
import { useProjectSettingsConnected as useProjectSettings } from 'thefactory-ui/web'
import {
  aggregateGroupBadgeState,
  chatBadgeTally,
  chatNotifyCountsOf,
  chatNotifyLevel,
  chatNotifyNews,
  EMPTY_BADGE_STATE,
  markSeen,
  resolveTriState,
  useBadgeCountsCore,
  type BadgeChatInput,
  type BadgeCounts,
  type BadgeState,
  type SignInChatRunner,
} from 'thefactory-ui/headless'
import { scopeSignInNames, useExpiredSignIns } from 'thefactory-ui/headless'
import {
  chatBadgeInputOf,
  useProcessRunChatNews,
  useProcessStopClock,
} from 'thefactory-ui/headless'
import { readChatsSeen, useAppTabLastOpened, useChatsSeen, writeChatsSeen } from 'thefactory-ui/web'

export type { BadgeCounts }

export type UseBadgeCountsApi = {
  /** Active-project / global counts (single source for sidebar header + favicon). */
  counts: BadgeCounts
  /** Stamp the active project's app tab as opened now — clears its unseen-results badge. */
  markAppOpened: () => void
  /** Per-project breakdown for sidebar project rows. Filtering respects
   *  the same `badgesEnabled` toggles `counts` uses. Git + tests are scoped
   *  to the ACTIVE project (those contexts only track the active one), so
   *  non-active projects report zero on those channels. */
  getProjectBadgeState: (projectId: string) => BadgeState
  /** Group badge state — member projects rolled up via the shared
   *  `aggregateGroupBadgeState`, plus the group's own chat unread. */
  getGroupBadgeState: (groupId: string, memberProjectIds: ReadonlyArray<string>) => BadgeState
  /** The group's OWN chats — what its Chat tab counts, so reading them clears it. */
  getGroupChatBadge: (groupId: string) => BadgeState['chat_messages']
}

/**
 * Mark a chat as read up to now. A plain write to the shared chats-seen store,
 * so a chat view marks itself read without mounting the badge counts — and
 * every list and fetch they hold.
 */
export function markChatSeen(ctx: ChatContext): void {
  writeChatsSeen(markSeen(readChatsSeen(), getChatContextKey(ctx), new Date().toISOString()))
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
  // Every project's live runs in one fetch, kept live over WS; bucketed by
  // project below so each row (and the group rollup) counts only its own.
  const { runs: processRuns } = useProcessRuns()
  const {
    runningCount: activityRunningCount,
    working: activityWorking,
    paused: activityPaused,
    liveForScope: activityLiveForScope,
    pausedForScope: activityPausedForScope,
    unseenForScope: activityUnseenForScope,
  } = useProjectActivities(activeProjectId)
  const {
    lastOpenedIso: appLastOpenedIso,
    markOpened: markAppOpened,
    getLastOpenedForProject: appLastOpenedForProject,
  } = useAppTabLastOpened(activeProjectId)

  // Subscribes to the singleton chats-seen store via useSyncExternalStore —
  // no per-hook state, no window-event listeners here. Multiple
  // useBadgeCounts instances share the same source of truth and re-render
  // in lockstep when any consumer marks a chat seen, without ever firing
  // setState during another component's render.
  const seen = useChatsSeen()
  const pendingAsksByChat = usePendingAsksByChat()


  // Annotate every chat with its derived unread + thinking state. Used twice:
  // once for the global `counts` (across all chats), and once filtered by
  // project for `getProjectBadgeState`.
  type AnnotatedChat = BadgeChatInput & {
    projectId?: string
    groupId?: string
    cliRunner?: SignInChatRunner | null
    contextKey: string
  }

  const annotatedChats: AnnotatedChat[] = useMemo(() => {
    return chats.map((chat) => {
      // Agent-run chats are hidden from the Chats list and are read-only, so they
      // must never light the unread badge — the list and the count finally agree.
      if (isAgentRunChatContext(chat.context)) {
        return {
          unreadMessages: 0,
          isThinking: false,
          projectId: chat.context.projectId,
          groupId: chat.context.groupId,
          cliRunner: chat.cliRunner,
          contextKey: getChatContextKey(chat.context),
        }
      }
      const key = getChatContextKey(chat.context)
      // What reaches the person of the chat at its notification level.
      const news = chatNotifyNews(
        chatNotifyCountsOf(chat, seen[key], pendingAsksByChat.get(key) ?? 0),
        chatNotifyLevel(chat, prefs.chatNotifyLevels),
      )
      return {
        ...chatBadgeInputOf(chat.context, {
          unreadMessages: news.unreadMessages,
          pendingAsks: news.pendingAsks,
          isThinking: getChatLiveState(chat.context).isSending,
        }),
        projectId: chat.context.projectId,
        groupId: chat.context.groupId,
        cliRunner: chat.cliRunner,
        contextKey: key,
      }
    })
  }, [chats, seen, getChatLiveState, pendingAsksByChat, prefs.chatNotifyLevels])

  // The top-level `counts` represents the ACTIVE project's badge state
  // (drives the per-tab nav badges and the favicon). Use only the active
  // project's annotated chats — feeding the global list here double-counts
  // unread chats from every other project. Per-project breakdowns for the
  // sidebar project rows go through `getProjectBadgeState` below.
  const activeProjectChats = useMemo(
    () => (activeProjectId ? annotatedChats.filter((c) => c.projectId === activeProjectId) : []),
    [annotatedChats, activeProjectId],
  )

  const stopNow = useProcessStopClock()
  const runChatNews = useProcessRunChatNews(seen)
  const processTallies = useMemo(
    () => processTallyByProject(processRuns, stopNow, runChatNews),
    [processRuns, stopNow, runChatNews],
  )
  const signIns = useExpiredSignIns(annotatedChats, processRuns)

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
    activity: {
      runningCount: activityRunningCount,
      isWorking: activityWorking,
      isPaused: activityPaused,
      unseenCount: activityUnseenForScope(activeProjectId, appLastOpenedIso),
    },
    processes: activeProjectId ? processTallies.get(activeProjectId) : undefined,
    signIn: activeProjectId ? signIns.byProject.get(activeProjectId) : undefined,
    enabled: {
      chat: resolveTriState(prefs.badgesEnabled.chat, projectOverride.chat),
      git: resolveTriState(prefs.badgesEnabled.git, projectOverride.git),
      tests: resolveTriState(prefs.badgesEnabled.tests, projectOverride.tests),
      activity: resolveTriState(prefs.badgesEnabled.activity, projectOverride.activity),
      processes: resolveTriState(prefs.badgesEnabled.processes, projectOverride.processes),
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
    (list: AnnotatedChat[]): BadgeState['chat_messages'] => {
      if (!chatEnabled) return { unread: 0, waiting: 0, thinking: false }
      return chatBadgeTally(list, prefs.chatBadgeCountMode)
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

      const activityEnabled = prefs.badgesEnabled.activity !== false
      const unseen = activityEnabled
        ? activityUnseenForScope(projectId, appLastOpenedForProject(projectId))
        : 0

      // Process runs are tracked for EVERY project (one global fetch), so unlike
      // git/tests a non-active project still reports its real counts.
      const processEnabled = prefs.badgesEnabled.processes !== false
      const proc = processEnabled ? processTallies.get(projectId) : undefined

      return {
        chat_messages: chat,
        git: { incoming, uncommitted },
        tests: { failing: failingTests },
        activity: {
          running: activityLiveForScope(projectId),
          paused: activityPausedForScope(projectId),
          unseen,
        },
        process: {
          running: proc?.running ?? 0,
          waiting: proc?.waiting ?? 0,
          failed: proc?.failed ?? 0,
          unread: proc?.unread ?? 0,
        },
        signIn: {
          expired: scopeSignInNames(signIns.byProject.get(projectId), {
            chat: prefs.badgesEnabled.chat,
            processes: prefs.badgesEnabled.processes,
          }),
        },
      }
    },
    [
      signIns,
      chatBadgeFor,
      chatsByProjectId,
      activeProjectId,
      activityLiveForScope,
      activityPausedForScope,
      activityUnseenForScope,
      appLastOpenedForProject,
      branches,
      status,
      lastRun,
      prefs.badgesEnabled,
      prefs.gitBadgeSubToggles,
      processTallies,
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
      agg.chat_messages.waiting += groupChat.waiting
      agg.chat_messages.thinking = agg.chat_messages.thinking || groupChat.thinking
      const groupSignIns = chatEnabled ? (signIns.byGroup.get(groupId) ?? []) : []
      agg.signIn = { expired: [...new Set([...agg.signIn.expired, ...groupSignIns])] }
      return agg
    },
    [getProjectBadgeState, chatsByGroupId, chatBadgeFor, chatEnabled, signIns],
  )

  const getGroupChatBadge = useCallback(
    (groupId: string): BadgeState['chat_messages'] =>
      chatBadgeFor(chatsByGroupId.get(groupId) ?? []),
    [chatsByGroupId, chatBadgeFor],
  )

  return {
    counts,
    markAppOpened,
    getProjectBadgeState,
    getGroupBadgeState,
    getGroupChatBadge,
  }
}
