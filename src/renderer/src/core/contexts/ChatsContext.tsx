import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  abortChatCompletion,
  addChatMessages,
  clearChat as clearChatApi,
  createTopicChat,
  deleteChat as deleteChatApi,
  deleteLastChatMessage,
  getChatsSettings,
  listChats,
  resumeCompletion,
  sendCompletionWithTools,
  updateChat,
} from 'thefactory-ui/headless/api'
import type {
  ChatContext as ChatCtx,
  GetChatResponse,
  GetChatsSettingsResponse,
  GetLlmConfigResponse,
  SendCompletionWithToolsData,
  SendCompletionWithToolsResponse,
  UpdateChatData,
  ChatMessage,
} from 'thefactory-ui/headless/api'
import { getChatContextKey } from '../chats/chatKey'
import { useApi } from './ApiContext'
import { useAuth } from './AuthContext'
import { useLLMConfigs } from './LLMConfigsContext'
import { useActiveProject } from './ProjectsContext'

type CompletionSettings = SendCompletionWithToolsData['body']['settings']
export type ChatSettingsPatch = NonNullable<
  NonNullable<UpdateChatData['body']['patch']>['settings']
>
type ProposedToolCall = SendCompletionWithToolsResponse['results'][number]['toolCalls'][number]

/**
 * Parameters captured from the in-flight `sendCompletionWithTools` so a
 * subsequent `resumeCompletion` can pick up where it left off. We persist
 * `settings` and `systemPrompt` here because the backend doesn't echo them
 * back; the user may grant tools minutes later and we must replay both
 * verbatim.
 */
export type PendingToolConfirmation = {
  toolCalls: ProposedToolCall[]
  settings: CompletionSettings
  systemPrompt?: string
  context: ChatCtx
}

/**
 * Per-chat live state. One entry per active chat context; mutations are
 * scoped so a slow project-chat send doesn't bleed its `Thinking…` into the
 * neighbouring story chat.
 */
export type ChatLiveState = {
  isSending: boolean
  pendingAssistant: { content: string; turn: number } | null
  pendingToolConfirmation: PendingToolConfirmation | null
  sendError: Error | null
}

const EMPTY_LIVE_STATE: ChatLiveState = {
  isSending: false,
  pendingAssistant: null,
  pendingToolConfirmation: null,
  sendError: null,
}

const FALLBACK_COMPLETION_SETTINGS: CompletionSettings = {
  maxTurns: 5,
  numberMessagesToSend: 30,
  availableTools: [],
  autoCallTools: [],
  forceFinishTools: [],
  finishTurnOnErrors: true,
  allowNoCallResponses: true,
  allowErrorResponses: true,
}

export type ChatsContextValue = {
  /** True once the first chat-list fetch for the active project has completed. */
  isLoaded: boolean
  loadError: Error | null

  /** Every chat belonging to the active project (any context type). */
  chats: GetChatResponse[]
  /** The project-level chat for the active project (context type `PROJECT`, no sub-ids). */
  projectChat: GetChatResponse | null
  /** The LLM config currently being used; `null` if none are configured. */
  activeLLMConfig: GetLlmConfigResponse | null

  /** Look up a chat by its `ChatContext`. Returns `null` if not yet created. */
  getChat: (ctx: ChatCtx) => GetChatResponse | null
  /**
   * Per-chat live state. Always returns a defaulted shape — never `null` —
   * so consumers can destructure directly.
   */
  getChatLiveState: (ctx: ChatCtx) => ChatLiveState

  /**
   * Per-chat in-memory draft text. Drafts survive context switches inside
   * a session but are intentionally not persisted — mirrors `overseer-local`'s
   * `useChatDrafts`. Read at the point you need the value (e.g. on chat open).
   */
  getDraft: (ctx: ChatCtx) => string
  setDraft: (ctx: ChatCtx, text: string) => void
  clearDraft: (ctx: ChatCtx) => void

  /**
   * Send a message in the given chat context. Persists the user message
   * first, then runs `sendCompletionWithTools`. The backend's chat
   * persistence callbacks write the assistant + tool messages into the
   * chat, so the call is followed by a `refresh()` to pull them in.
   */
  sendMessage: (ctx: ChatCtx, content: string) => Promise<void>
  /**
   * Resume the in-flight completion for `ctx`, granting the listed
   * tool-call ids. Tools not in `grantedToolCallIds` come back as
   * `not_allowed`. Pass `[]` to deny everything.
   */
  confirmTools: (ctx: ChatCtx, grantedToolCallIds: string[]) => Promise<void>
  /** Drop the pending tool confirmation for `ctx` without resuming. */
  cancelToolConfirmation: (ctx: ChatCtx) => void
  /** Clear all messages in the chat — keeps the chat record itself. Mirrors
   * desktop's `restartChat`. */
  clearChat: (ctx: ChatCtx) => Promise<void>
  /** Delete the chat entirely. Backend rejects deletion of the canonical
   * `PROJECT` chat — callers should guard against that case. */
  deleteChat: (ctx: ChatCtx) => Promise<void>
  /** Delete the last message in the chat. Used by the message-hover delete
   * affordance. */
  deleteLastMessage: (ctx: ChatCtx) => Promise<void>
  /**
   * Cancel the in-flight chat completion for `ctx`. No-op when nothing is
   * in flight. The HTTP call resolves with `resultType: 'aborted'` rather
   * than throwing — the upstream loop checks `abortSignal.aborted` between
   * turns and tool calls.
   */
  abortChat: (ctx: ChatCtx) => Promise<void>

  /**
   * Create a new `PROJECT_TOPIC` chat under the given project. Returns the
   * fresh chat shape; the chat list is refreshed in the background.
   */
  createProjectTopic: (projectId: string, title: string) => Promise<GetChatResponse>
  createGroupTopic: (groupId: string, title: string) => Promise<GetChatResponse>

  /**
   * Returns the per-context settings — `systemPrompt` + `completionSettings` —
   * that were loaded from `getChatsSettings`. Falls back to safe defaults so
   * UI code can render without checking for null.
   */
  getEffectiveChatSettings: (ctx: ChatCtx) => ChatSettingsPatch
  /**
   * Persist a settings patch on a chat. The backend stores them on the chat
   * itself; subsequent sends pick them up via `getChatsSettings`. The chat
   * must already exist server-side (typically true after the first message).
   */
  updateChatSettings: (ctx: ChatCtx, patch: Partial<ChatSettingsPatch>) => Promise<void>

  refresh: () => Promise<void>
}

const ChatsContext = createContext<ChatsContextValue | null>(null)

function nowIso(): string {
  return new Date().toISOString()
}

function buildUserMessage(content: string): ChatMessage {
  const ts = nowIso()
  return {
    role: 'user',
    content,
    startedAt: ts,
    completedAt: ts,
    durationMs: 0,
  }
}

function sameContext(a: ChatCtx, b: ChatCtx): boolean {
  return getChatContextKey(a) === getChatContextKey(b)
}

/**
 * Collect tool calls that need user grant from the latest turn of a
 * `CompletionResponseTurns` whose `resultType` is `require_confirmation`.
 * Returns the proposed `toolCalls` from the trailing turn — these carry the
 * `toolCallId`s the resume call's `toolsGranted` array references.
 */
function collectProposedToolCalls(result: SendCompletionWithToolsResponse): ProposedToolCall[] {
  const lastTurn = result.results[result.results.length - 1]
  return lastTurn?.toolCalls ?? []
}

export function ChatsProvider({ children }: { children: ReactNode }) {
  const { ws } = useApi()
  const { token } = useAuth()
  const { projectId } = useActiveProject()
  const { configs: llmConfigs, activeChatConfig } = useLLMConfigs()

  const [chats, setChats] = useState<GetChatResponse[]>([])
  const [chatSettings, setChatSettings] = useState<GetChatsSettingsResponse | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [liveStateByKey, setLiveStateByKey] = useState<Map<string, ChatLiveState>>(() => new Map())

  /**
   * Tracks the chat context that currently has a `sendCompletionWithTools` /
   * `resumeCompletion` in flight, so the global `completion:progress` WS
   * stream can be routed back to the right per-chat `pendingAssistant`. The
   * backend's progress payload doesn't echo the chatContext today, so this
   * ref is the only way to disambiguate when multiple chats are visible.
   */
  const inFlightCtxRef = useRef<ChatCtx | null>(null)

  // Per-chat draft text. Ref-based (no re-render on draft change) so a
  // sibling that doesn't read this chat's draft doesn't churn. Matches
  // `overseer-local`'s `useChatDrafts`.
  const draftsRef = useRef<Record<string, string>>({})
  const getDraft = useCallback((ctx: ChatCtx): string => {
    return draftsRef.current[getChatContextKey(ctx)] ?? ''
  }, [])
  const setDraft = useCallback((ctx: ChatCtx, text: string) => {
    draftsRef.current[getChatContextKey(ctx)] = text
  }, [])
  const clearDraft = useCallback((ctx: ChatCtx) => {
    delete draftsRef.current[getChatContextKey(ctx)]
  }, [])

  const updateLiveState = useCallback((ctx: ChatCtx, patch: Partial<ChatLiveState>) => {
    const key = getChatContextKey(ctx)
    setLiveStateByKey((prev) => {
      const next = new Map(prev)
      const cur = next.get(key) ?? EMPTY_LIVE_STATE
      next.set(key, { ...cur, ...patch })
      return next
    })
  }, [])

  const getChatLiveState = useCallback(
    (ctx: ChatCtx): ChatLiveState => liveStateByKey.get(getChatContextKey(ctx)) ?? EMPTY_LIVE_STATE,
    [liveStateByKey],
  )

  const refresh = useCallback(async () => {
    if (!token) {
      setChats([])
      setIsLoaded(true)
      setLoadError(null)
      return
    }
    try {
      // Load ALL chats (no projectId filter) so the sidebar can render
      // per-project unread / thinking badges for every project, not just
      // the active one. Without this the badges flash on project switch
      // and never settle for non-active projects.
      const { data } = await listChats({ throwOnError: true })
      setChats(data)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoaded(true)
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      setChats([])
      setIsLoaded(true)
      setLoadError(null)
      setLiveStateByKey(new Map())
      return
    }
    void refresh()
  }, [token, refresh])

  useEffect(() => ws.on('chats:updated', () => void refresh()), [ws, refresh])

  // Load chat settings once auth lands. The map is keyed by ChatContextType
  // (PROJECT, STORY, …) and supplies the systemPrompt + completionSettings
  // we forward to send-with-tools / resume.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    void (async () => {
      try {
        const { data } = await getChatsSettings({ throwOnError: true })
        if (!cancelled) setChatSettings(data)
      } catch {
        // The settings endpoint is non-critical; chat send falls back to
        // FALLBACK_COMPLETION_SETTINGS until it lands.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  // Subscribe to completion progress: per-turn partial messages and a final
  // `done` envelope. The backend's payload is loosely typed so we narrow
  // defensively before reading from it. Routes back to the in-flight chat
  // via `inFlightCtxRef`.
  useEffect(() => {
    type ProgressTurn = { turn: number; assistantMessage?: { content?: string } }
    type ProgressDone = { done: true }
    const isTurn = (v: unknown): v is ProgressTurn =>
      typeof v === 'object' && v !== null && typeof (v as ProgressTurn).turn === 'number'
    const isDone = (v: unknown): v is ProgressDone =>
      typeof v === 'object' && v !== null && (v as ProgressDone).done === true
    return ws.on('completion:progress', (data) => {
      const target = inFlightCtxRef.current
      if (!target) return
      if (isDone(data)) {
        updateLiveState(target, { pendingAssistant: null })
        return
      }
      if (isTurn(data)) {
        const content = data.assistantMessage?.content ?? ''
        updateLiveState(target, { pendingAssistant: { turn: data.turn, content } })
      }
    })
  }, [ws, updateLiveState])

  // The project-level chat is the one scoped directly to the active project
  // (no story / feature / topic). It's what the chat sidebar pins at the top.
  const projectChat = useMemo<GetChatResponse | null>(() => {
    if (!projectId) return null
    return (
      chats.find(
        (c) =>
          c.context.type === 'PROJECT' &&
          c.context.projectId === projectId &&
          !c.context.topicId &&
          !c.context.storyId &&
          !c.context.featureId,
      ) ?? null
    )
  }, [chats, projectId])

  const activeLLMConfig = activeChatConfig ?? llmConfigs[0] ?? null

  const getChat = useCallback(
    (ctx: ChatCtx): GetChatResponse | null =>
      chats.find((c) => sameContext(c.context, ctx)) ?? null,
    [chats],
  )

  /**
   * Build the per-context settings + system prompt forwarded to
   * send-with-tools. Override `autoCallTools` to `[]` so every proposed tool
   * surfaces as `require_confirmation` to the user — the backend will mark
   * each tool message accordingly and bubble up `resultType:
   * require_confirmation`.
   */
  const buildToolSettings = useCallback(
    (context: ChatCtx): { settings: CompletionSettings; systemPrompt?: string } => {
      const entry = chatSettings?.[context.type]
      const base = entry?.completionSettings ?? FALLBACK_COMPLETION_SETTINGS
      return {
        settings: { ...base, autoCallTools: [] },
        systemPrompt: entry?.systemPrompt,
      }
    },
    [chatSettings],
  )

  const sendMessage = useCallback(
    async (ctx: ChatCtx, content: string) => {
      if (!activeLLMConfig) throw new Error('Configure an LLM before sending messages')
      const trimmed = content.trim()
      if (trimmed.length === 0) return

      updateLiveState(ctx, {
        isSending: true,
        sendError: null,
        pendingAssistant: null,
        pendingToolConfirmation: null,
      })
      inFlightCtxRef.current = ctx
      try {
        const userMessage = buildUserMessage(trimmed)
        await addChatMessages({
          body: { context: ctx, messages: [userMessage] },
          throwOnError: true,
        })

        const { settings, systemPrompt } = buildToolSettings(ctx)
        const priorMessages = getChat(ctx)?.messages ?? []
        const { data: result } = await sendCompletionWithTools({
          body: {
            request: {
              chatContext: ctx,
              llmConfig: activeLLMConfig,
              messages: [...priorMessages, userMessage],
              ...(systemPrompt ? { systemPrompt } : {}),
            },
            settings,
          },
          throwOnError: true,
        })

        if (result.resultType === 'require_confirmation') {
          const proposed = collectProposedToolCalls(result)
          if (proposed.length > 0) {
            updateLiveState(ctx, {
              pendingToolConfirmation: {
                toolCalls: proposed,
                settings,
                systemPrompt,
                context: ctx,
              },
            })
          }
        }
        await refresh()
      } catch (err) {
        updateLiveState(ctx, {
          sendError: err instanceof Error ? err : new Error(String(err)),
        })
      } finally {
        if (inFlightCtxRef.current && sameContext(inFlightCtxRef.current, ctx)) {
          inFlightCtxRef.current = null
        }
        updateLiveState(ctx, { isSending: false, pendingAssistant: null })
      }
    },
    [activeLLMConfig, buildToolSettings, getChat, refresh, updateLiveState],
  )

  const confirmTools = useCallback(
    async (ctx: ChatCtx, grantedToolCallIds: string[]) => {
      const live = getChatLiveState(ctx)
      const pending = live.pendingToolConfirmation
      if (!pending) return
      if (!activeLLMConfig) throw new Error('Configure an LLM before resuming')

      updateLiveState(ctx, {
        isSending: true,
        sendError: null,
        pendingAssistant: null,
      })
      inFlightCtxRef.current = ctx
      try {
        // Pull the latest chat so trailing `require_confirmation` tool
        // messages are included in the resume request — the backend's resume
        // flow scans messages from the end backwards.
        const { data: latest } = await listChats({
          query: projectId ? { projectId } : {},
          throwOnError: true,
        })
        setChats(latest)
        const target = latest.find((c) => sameContext(c.context, pending.context))
        if (!target) throw new Error('Chat for pending confirmation no longer exists')

        const { data: result } = await resumeCompletion({
          body: {
            request: {
              chatContext: target.context,
              llmConfig: activeLLMConfig,
              messages: target.messages ?? [],
              ...(pending.systemPrompt ? { systemPrompt: pending.systemPrompt } : {}),
            },
            settings: pending.settings,
            toolsGranted: grantedToolCallIds,
          },
          throwOnError: true,
        })

        if (result.resultType === 'require_confirmation') {
          const proposed = collectProposedToolCalls(result)
          updateLiveState(ctx, {
            pendingToolConfirmation:
              proposed.length > 0 ? { ...pending, toolCalls: proposed } : null,
          })
        } else {
          updateLiveState(ctx, { pendingToolConfirmation: null })
        }
        await refresh()
      } catch (err) {
        updateLiveState(ctx, {
          sendError: err instanceof Error ? err : new Error(String(err)),
        })
      } finally {
        if (inFlightCtxRef.current && sameContext(inFlightCtxRef.current, ctx)) {
          inFlightCtxRef.current = null
        }
        updateLiveState(ctx, { isSending: false, pendingAssistant: null })
      }
    },
    [activeLLMConfig, getChatLiveState, projectId, refresh, updateLiveState],
  )

  const cancelToolConfirmation = useCallback(
    (ctx: ChatCtx) => {
      updateLiveState(ctx, { pendingToolConfirmation: null })
    },
    [updateLiveState],
  )

  const abortChat = useCallback(async (ctx: ChatCtx) => {
    try {
      await abortChatCompletion({ body: { context: ctx }, throwOnError: true })
    } catch {
      // 404 means no completion was in flight — harmless. Other errors
      // are intentionally swallowed: the user already chose to abort,
      // and the in-flight call (if any) will surface its own outcome.
    }
  }, [])

  const clearChat = useCallback(
    async (ctx: ChatCtx) => {
      await clearChatApi({ body: { context: ctx }, throwOnError: true })
      await refresh()
    },
    [refresh],
  )

  const deleteChat = useCallback(
    async (ctx: ChatCtx) => {
      await deleteChatApi({ body: { context: ctx }, throwOnError: true })
      await refresh()
    },
    [refresh],
  )

  const deleteLastMessage = useCallback(
    async (ctx: ChatCtx) => {
      await deleteLastChatMessage({ body: { context: ctx }, throwOnError: true })
      await refresh()
    },
    [refresh],
  )

  const getEffectiveChatSettings = useCallback(
    (ctx: ChatCtx): ChatSettingsPatch => {
      const chat = chats.find((c) => sameContext(c.context, ctx))
      if (chat?.settings) return chat.settings
      const entry = chatSettings?.[ctx.type]
      return {
        systemPrompt: entry?.systemPrompt ?? '',
        completionSettings: entry?.completionSettings ?? FALLBACK_COMPLETION_SETTINGS,
      }
    },
    [chats, chatSettings],
  )

  const updateChatSettings = useCallback(
    async (ctx: ChatCtx, patch: Partial<ChatSettingsPatch>) => {
      const current = getEffectiveChatSettings(ctx)
      const merged: ChatSettingsPatch = {
        systemPrompt: patch.systemPrompt ?? current.systemPrompt,
        completionSettings: {
          ...current.completionSettings,
          ...(patch.completionSettings ?? {}),
        },
      }
      await updateChat({
        body: { context: ctx, patch: { settings: merged } },
        throwOnError: true,
      })
      await refresh()
    },
    [getEffectiveChatSettings, refresh],
  )

  const createProjectTopic = useCallback(
    async (entityProjectId: string, title: string) => {
      const trimmed = title.trim()
      if (trimmed.length === 0) throw new Error('Title required')
      const { data } = await createTopicChat({
        body: { type: 'project', entityId: entityProjectId, title: trimmed },
        throwOnError: true,
      })
      // The backend broadcasts `chats:updated`, but we refresh inline so
      // the caller can navigate to the new chat without waiting for the WS.
      await refresh()
      return data
    },
    [refresh],
  )

  const createGroupTopic = useCallback(
    async (groupId: string, title: string) => {
      const trimmed = title.trim()
      if (trimmed.length === 0) throw new Error('Title required')
      const { data } = await createTopicChat({
        body: { type: 'group', entityId: groupId, title: trimmed },
        throwOnError: true,
      })
      await refresh()
      return data
    },
    [refresh],
  )

  const value = useMemo<ChatsContextValue>(
    () => ({
      isLoaded,
      loadError,
      chats,
      projectChat,
      activeLLMConfig,
      getChat,
      getChatLiveState,
      getDraft,
      setDraft,
      clearDraft,
      sendMessage,
      confirmTools,
      cancelToolConfirmation,
      abortChat,
      clearChat,
      deleteChat,
      deleteLastMessage,
      createProjectTopic,
      createGroupTopic,
      getEffectiveChatSettings,
      updateChatSettings,
      refresh,
    }),
    [
      isLoaded,
      loadError,
      chats,
      projectChat,
      activeLLMConfig,
      getChat,
      getChatLiveState,
      getDraft,
      setDraft,
      clearDraft,
      sendMessage,
      confirmTools,
      cancelToolConfirmation,
      abortChat,
      clearChat,
      deleteChat,
      deleteLastMessage,
      createProjectTopic,
      createGroupTopic,
      getEffectiveChatSettings,
      updateChatSettings,
      refresh,
    ],
  )

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
}

export function useChats(): ChatsContextValue {
  const ctx = useContext(ChatsContext)
  if (!ctx) throw new Error('useChats must be used within ChatsProvider')
  return ctx
}
