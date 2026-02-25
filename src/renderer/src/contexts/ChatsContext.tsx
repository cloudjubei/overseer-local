import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  LLMConfig,
  ChatContext,
  Chat,
  CompletionMessage,
  ChatUpdate,
  ChatsSettings,
  ChatSettings,
  ChatContextArguments,
  CompletionSettings,
} from 'thefactory-tools'
import { getChatContextPath } from 'thefactory-tools/utils'
import { chatsService } from '../services/chatsService'
import { projectsService } from '../services/projectsService'
import { useActiveProject } from './ProjectContext'
import { completionService } from '@renderer/services/completionService'
import { notificationsService } from '@renderer/services/notificationsService'

export type ChatState = {
  key: string
  chat: Chat
  isLoading: boolean
  isThinking: boolean
}

export type ChatDraft = {
  text: string
  attachments: string[]
  selectionStart?: number
  selectionEnd?: number
}

export type ChatsContextValue = {
  chats: Record<string, ChatState>
  chatsByProjectId: Record<string, ChatState[]>

  // In-memory-only draft state. Keyed by getChatContextPath(context).
  getDraft: (chatKey: string) => ChatDraft
  setDraft: (chatKey: string, patch: Partial<ChatDraft>) => void
  clearDraft: (chatKey: string) => void

  sendMessage: (
    context: ChatContext,
    message: string,
    prompt: string,
    settings: ChatSettings,
    config: LLMConfig,
    files?: string[],
  ) => Promise<void>
  resumeTools: (
    context: ChatContext,
    toolsGranted: string[],
    prompt: string,
    settings: ChatSettings,
    config: LLMConfig,
  ) => Promise<void>
  retryCompletion: (
    context: ChatContext,
    prompt: string,
    settings: ChatSettings,
    config: LLMConfig,
  ) => Promise<void>

  abortMessage: (context: ChatContext) => Promise<void>

  getChatIfExists: (context: ChatContext) => Promise<ChatState | undefined>
  getChat: (context: ChatContext) => Promise<ChatState>
  restartChat: (context: ChatContext) => Promise<ChatState>
  deleteChat: (context: ChatContext) => Promise<void>
  deleteLastMessage: (context: ChatContext) => Promise<void>

  // Settings APIs
  allChatSettings: ChatsSettings | undefined
  getSettings: (context: ChatContext) => ChatSettings | undefined
  resetSettings: (context: ChatContext) => Promise<ChatSettings | undefined>

  updateCompletionSettings: (
    context: ChatContext,
    patch: Partial<CompletionSettings>,
  ) => Promise<ChatSettings | undefined>

  getDefaultPrompt: (chatContext: ChatContext) => Promise<string>
  getSettingsPrompt: (contextArguments: ChatContextArguments) => Promise<string>
  updateSettingsPrompt: (context: ChatContext, prompt: string) => Promise<string | undefined>
  resetSettingsPrompt: (context: ChatContext) => Promise<string | undefined>
}

const ChatsContext = createContext<ChatsContextValue | null>(null)

function extractSettingsForContext(
  all?: ChatsSettings,
  context?: ChatContext,
): ChatSettings | undefined {
  if (!all || !context) return undefined
  switch (context.type) {
    case 'PROJECT':
      return all.PROJECT
    case 'STORY':
      return all.STORY
    case 'FEATURE':
      return all.FEATURE
    case 'AGENT_RUN':
      return all.AGENT_RUN
    case 'AGENT_RUN_FEATURE':
      return all.AGENT_RUN_FEATURE
    case 'PROJECT_TOPIC':
      return all.PROJECT_TOPIC[context.projectTopic!]
    case 'STORY_TOPIC':
      return all.STORY_TOPIC[context.storyTopic!]
    default:
      return all.GENERAL
  }
}

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useActiveProject()
  const [chats, setChats] = useState<Record<string, ChatState>>({})
  const [chatsByProjectId, setChatsByProjectId] = useState<Record<string, ChatState[]>>({})
  const [allChatSettings, setAllChatSettings] = useState<ChatsSettings | undefined>(undefined)

  // Per-chat in-memory draft message + pending attachments.
  const draftsRef = useRef<Record<string, ChatDraft>>({})

  const defaultDraftsRef = useRef<Record<string, ChatDraft>>({})

  // getDraft is intentionally ref-based (stable identity, no re-render cascade).
  // Consumers should read it at the point they need the value (e.g. on chat switch),
  // NOT as a reactive dependency.
  const getDraft = useCallback((chatKey: string): ChatDraft => {
    const existing = draftsRef.current[chatKey]
    if (existing) return existing

    const cached = defaultDraftsRef.current[chatKey]
    if (cached) return cached

    const def: ChatDraft = { text: '', attachments: [] }
    defaultDraftsRef.current[chatKey] = def
    return def
  }, [])

  const setDraft = useCallback((chatKey: string, patch: Partial<ChatDraft>) => {
    const cur = draftsRef.current[chatKey] || { text: '', attachments: [] }
    draftsRef.current[chatKey] = { ...cur, ...patch }
  }, [])

  const clearDraft = useCallback((chatKey: string) => {
    delete draftsRef.current[chatKey]
  }, [])

  const lastAssistantNotifiedRef = useRef<Record<string, number>>({})
  const chatKeyToProjectIdRef = useRef<Record<string, string>>({})

  const removeLastOpenedChatKey = useCallback((projectId: string, chatKey: string) => {
    try {
      const storageKey = `chat-last-opened:${projectId}`
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const map = JSON.parse(raw) as Record<string, number>
      if (!map || typeof map !== 'object') return
      if (!(chatKey in map)) return
      delete map[chatKey]
      localStorage.setItem(storageKey, JSON.stringify(map))
    } catch {
      // ignore invalid/missing localStorage
    }
  }, [])

  // Track recently-deleted chat keys so that getChat does not accidentally
  // re-create them via the auto-create behaviour in ChatsTools.getChat.
  const deletedKeysRef = useRef<Set<string>>(new Set())

  const upsertChatsByProject = useCallback((chatState: ChatState) => {
    const ctx = chatState.chat.context
    const pid = ctx.projectId
    if (!pid) return
    setChatsByProjectId((prev) => {
      const existing = prev[pid] || []
      const idx = existing.findIndex((c) => c.key === chatState.key)
      let nextForProject: ChatState[]
      if (idx >= 0) {
        nextForProject = existing.map((c, i) => (i === idx ? { ...c, ...chatState } : c))
      } else {
        nextForProject = [...existing, chatState]
      }
      return { ...prev, [pid]: nextForProject }
    })
  }, [])

  const removeFromChatsByProject = useCallback((chatState: ChatState) => {
    const ctx = chatState.chat.context
    const pid = ctx.projectId
    if (!pid) return
    setChatsByProjectId((prev) => {
      const existing = prev[pid] || []
      const nextForProject = existing.filter((c) => c.key !== chatState.key)
      return { ...prev, [pid]: nextForProject }
    })
  }, [])

  const updateChatState = useCallback(
    (key: string, updates: Partial<ChatState>) => {
      setChats((prev) => {
        const current = prev[key]
        const base: ChatState = current || {
          key,
          chat: (updates as any).chat,
          isLoading: false,
          isThinking: false,
        }
        const next: ChatState = { ...base, ...updates }
        if (next.chat) {
          upsertChatsByProject(next)
        }
        return { ...prev, [key]: next }
      })
    },
    [upsertChatsByProject],
  )

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [projects, settings] = await Promise.all([
          projectsService.listProjects(),
          chatsService.getChatSettings(),
        ])
        setAllChatSettings(settings)

        const byProject: Record<string, ChatState[]> = {}
        const all: Record<string, ChatState> = {}
        for (const project of projects) {
          try {
            const projectChats = await chatsService.listChats(project.id)
            const chatStates: ChatState[] = projectChats.map((chat) => ({
              key: getChatContextPath(chat.context),
              chat,
              isLoading: false,
              isThinking: false,
            }))
            byProject[project.id] = chatStates
            for (const c of chatStates) {
              all[c.key] = c
              chatKeyToProjectIdRef.current[c.key] = project.id
              try {
                const msgs = c.chat?.messages || []
                let lastAssistantIdx = -1
                for (let i = msgs.length - 1; i >= 0; i--) {
                  const role = (msgs[i] as any)?.role
                  if (role === 'assistant') {
                    lastAssistantIdx = i
                    break
                  }
                }
                lastAssistantNotifiedRef.current[c.key] = lastAssistantIdx
              } catch (_) {}
            }
          } catch (e) {
            console.error(`Failed to list chats for project ${project.id}`, e)
          }
        }
        setChats(all)
        setChatsByProjectId(byProject)
      } catch (e) {
        console.error('Failed to load chats/settings', e)
      }
    }
    void loadAll()
  }, [])

  useEffect(() => {
    const unsubscribe = chatsService.subscribe((chatUpdate: ChatUpdate) => {
      setChats((prev) => {
        const newChats = { ...prev }
        const key = getChatContextPath(chatUpdate.context)

        if (chatUpdate.type === 'delete') {
          const existing = newChats[key]
          if (existing) removeFromChatsByProject(existing)
          // Ensure getChat won't auto-recreate this chat.
          deletedKeysRef.current.add(key)

          try {
            const pid =
              (existing?.chat?.context as any)?.projectId ||
              (chatUpdate.context as any)?.projectId ||
              projectId
            if (pid) removeLastOpenedChatKey(pid, key)
          } catch (_) {}

          delete newChats[key]
          try {
            delete chatKeyToProjectIdRef.current[key]
          } catch (_) {}

          try {
            const pid =
              (existing?.chat?.context as any)?.projectId ||
              (chatUpdate.context as any)?.projectId ||
              projectId
            if (pid) {
              void (async () => {
                try {
                  const recent = await notificationsService.getRecentNotifications(pid)
                  const targets = (recent || []).filter((n: any) => {
                    if (n.read) return false
                    if (n.category !== 'chat_messages') return false
                    const md = (n.metadata || {}) as any
                    return md.chatKey === key
                  })
                  for (const n of targets) {
                    try {
                      await notificationsService.markNotificationAsRead(pid, n.id)
                    } catch (_) {}
                  }
                } catch (_) {}
              })()
            }
          } catch (_) {}

          try {
            clearDraft(key)
          } catch (_) {}

          return newChats
        }

        if (chatUpdate.type === 'change') {
          // If this key was recently deleted, ignore any late 'change/add'
          // events that could resurrect an empty chat.
          if (deletedKeysRef.current.has(key)) {
            return newChats
          }

          const next: ChatState = {
            ...(newChats[key] || {
              key,
              isLoading: false,
              isThinking: false,
              chat: chatUpdate.chat!,
            }),
            chat: chatUpdate.chat!,
          }
          newChats[key] = next
          upsertChatsByProject(next)

          try {
            const pidFromChat = chatUpdate.chat?.context?.projectId
            const pidFromCtx = chatUpdate.context.projectId
            const pid = pidFromChat || pidFromCtx
            if (pid) chatKeyToProjectIdRef.current[key] = pid
          } catch (_) {}

          // Notify on new assistant messages
          try {
            const msgs = chatUpdate.chat?.messages || []
            let lastAssistantIdx = -1
            for (let i = msgs.length - 1; i >= 0; i--) {
              const role = (msgs[i] as any)?.role
              if (role === 'assistant') {
                lastAssistantIdx = i
                break
              }
            }
            if (lastAssistantIdx >= 0) {
              const prevChat = prev[key]?.chat
              let prevAssistantIdx = -1
              if (prevChat) {
                const prevMsgs = prevChat.messages || []
                for (let i = prevMsgs.length - 1; i >= 0; i--) {
                  const role = (prevMsgs[i] as any)?.role
                  if (role === 'assistant') {
                    prevAssistantIdx = i
                    break
                  }
                }
              }
              const seenIdx = lastAssistantNotifiedRef.current[key] ?? -1
              const baseline = Math.max(prevAssistantIdx, seenIdx)
              const isLatestAssistant = (msgs[lastAssistantIdx] as any)?.role === 'assistant'

              if (isLatestAssistant && lastAssistantIdx > baseline) {
                lastAssistantNotifiedRef.current[key] = lastAssistantIdx

                const ctx = chatUpdate.context
                let title = 'New assistant message'
                switch (ctx.type) {
                  case 'PROJECT':
                    title = 'Project chat update'
                    break
                  case 'STORY':
                    title = 'Story chat update'
                    break
                  case 'FEATURE':
                    title = 'Feature chat update'
                    break
                  case 'PROJECT_TOPIC':
                  case 'STORY_TOPIC':
                    title = 'Topic chat update'
                    break
                  case 'AGENT_RUN':
                  case 'AGENT_RUN_FEATURE':
                    title = 'Agent run chat update'
                    break
                }

                const raw = String((msgs[lastAssistantIdx] as any)?.content || '')
                const snippet = raw.replace(/\s+/g, ' ').slice(0, 120)
                const message = snippet || 'Assistant responded'

                const enc = (v: string | number | boolean | null | undefined) =>
                  encodeURIComponent(String(v ?? ''))

                const actionUrl = (() => {
                  switch (ctx.type) {
                    case 'PROJECT':
                      return `#chat/project/${enc(ctx.projectId)}`
                    case 'STORY':
                      return `#chat/story/${enc(ctx.storyId)}`
                    case 'FEATURE':
                      return `#chat/feature/${enc(ctx.storyId)}/${enc(ctx.featureId)}`
                    case 'PROJECT_TOPIC':
                      return `#chat/project-topic/${enc(ctx.projectId)}/${enc(ctx.projectTopic)}`
                    case 'STORY_TOPIC':
                      return `#chat/story-topic/${enc(ctx.storyId)}/${enc(ctx.storyTopic)}`
                    case 'AGENT_RUN':
                      return `#chat/agent-run/${enc(ctx.projectId)}/${enc(ctx.storyId)}/${enc(ctx.agentRunId)}`
                    case 'AGENT_RUN_FEATURE':
                      return `#chat/agent-run-feature/${enc(ctx.projectId)}/${enc(ctx.storyId)}/${enc(ctx.featureId)}/${enc(ctx.agentRunId)}`
                    default:
                      return '#chat'
                  }
                })()

                const resolvedPid =
                  chatKeyToProjectIdRef.current[key] ||
                  chatUpdate.chat?.context?.projectId ||
                  ctx.projectId ||
                  projectId

                if (resolvedPid) {
                  const chatKey = key
                  void notificationsService
                    .create(resolvedPid, {
                      type: 'info',
                      category: 'chat_messages',
                      title,
                      message,
                      metadata: { actionUrl, chatKey },
                    })
                    .catch(() => {})
                }
              } else {
                lastAssistantNotifiedRef.current[key] = Math.max(baseline, lastAssistantIdx)
              }
            }
          } catch (_) {}

          return newChats
        }

        // Fallback: treat as add
        // If this key was recently deleted, ignore any late 'add' events.
        if (deletedKeysRef.current.has(key)) {
          return newChats
        }

        const next: ChatState = {
          key,
          chat: chatUpdate.chat!,
          isLoading: false,
          isThinking: false,
        }
        newChats[key] = next
        upsertChatsByProject(next)
        return newChats
      })
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [upsertChatsByProject, removeFromChatsByProject, projectId, clearDraft])

  const getChatIfExists = useCallback(
    async (context: ChatContext): Promise<ChatState | undefined> => {
      const key = getChatContextPath(context)

      // If this chat was recently deleted, do not call the backend which
      // would auto-create an empty replacement file.
      if (deletedKeysRef.current.has(key)) {
        return undefined
      }

      const c = chats[key]
      if (c) return c

      const chat = await chatsService.getChat(context)
      const chatState: ChatState = { key, chat, isLoading: false, isThinking: false }
      updateChatState(key, chatState)
      try {
        const pid = chat.context?.projectId
        if (pid) chatKeyToProjectIdRef.current[key] = pid
      } catch (_) {}
      return chatState
    },
    [chats, updateChatState],
  )

  const getChat = useCallback(
    async (context: ChatContext): Promise<ChatState> => {
      const chatState = await getChatIfExists(context)
      if (!chatState) throw new Error('Chat does not exist')
      return chatState
    },
    [getChatIfExists],
  )

  const sendMessage = useCallback(
    async (
      context: ChatContext,
      message: string,
      prompt: string,
      settings: ChatSettings,
      config: LLMConfig,
      files?: string[],
    ) => {
      const key = getChatContextPath(context)
      const chatState = await getChat(context)
      if (chatState.isThinking) return

      const now = new Date().toISOString()
      const userMessage: CompletionMessage = {
        role: 'user',
        content: message,
        files: files && files.length ? files : undefined,
        startedAt: now,
        completedAt: now,
        durationMs: 0,
      } as any

      const prevMessages = chatState.chat.messages || []
      const chatMessages = [...prevMessages, userMessage]
      updateChatState(key, {
        ...chatState,
        chat: { ...chatState.chat, messages: chatMessages },
        isThinking: true,
      })

      const chatProjectId = context.projectId ?? projectId
      try {
        await completionService.sendCompletionTools(
          chatProjectId,
          context,
          userMessage,
          prompt,
          settings.completionSettings,
          config,
        )
      } catch (e) {
        console.error('completionService.sendCompletionTools:', e)
      } finally {
        updateChatState(key, { isThinking: false })
      }
    },
    [projectId, getChat, updateChatState],
  )

  const resumeTools = useCallback(
    async (
      context: ChatContext,
      toolsGranted: string[],
      prompt: string,
      settings: ChatSettings,
      config: LLMConfig,
    ) => {
      const key = getChatContextPath(context)
      const chatState = await getChat(context)
      if (chatState.isThinking) return

      updateChatState(key, { ...chatState, isThinking: true })

      const chatProjectId = context.projectId ?? projectId
      try {
        await completionService.resumeCompletionTools(
          chatProjectId,
          context,
          toolsGranted,
          prompt,
          settings.completionSettings,
          config,
        )
      } catch (e) {
        console.error('completionService.resumeCompletionTools:', e)
      } finally {
        updateChatState(key, { isThinking: false })
      }
    },
    [projectId, getChat, updateChatState],
  )

  const retryCompletion = useCallback(
    async (context: ChatContext, prompt: string, settings: ChatSettings, config: LLMConfig) => {
      const key = getChatContextPath(context)
      const chatState = await getChat(context)
      if (chatState.isThinking) return

      updateChatState(key, { ...chatState, isThinking: true })

      const chatProjectId = context.projectId ?? projectId
      try {
        await completionService.retryCompletionTools(
          chatProjectId,
          context,
          prompt,
          settings.completionSettings,
          config,
        )
      } catch (e) {
        console.error('completionService.retryCompletionTools:', e)
      } finally {
        updateChatState(key, { isThinking: false })
      }
    },
    [projectId, getChat, updateChatState],
  )

  const abortMessage = useCallback(async (context: ChatContext) => {
    try {
      await completionService.abortCompletion(context)
    } catch (e) {
      console.warn('Abort failed or not available for chat', e)
    }
  }, [])

  const restartChat = useCallback(
    async (context: ChatContext): Promise<ChatState> => {
      const key = getChatContextPath(context)

      // User explicitly wants this chat to exist again.
      deletedKeysRef.current.delete(key)
      const now = new Date().toISOString()

      // Optimistically clear in the UI.
      const optimistic: ChatState = {
        key,
        chat: { context, messages: [], createdAt: now, updatedAt: now },
        isLoading: false,
        isThinking: false,
      }
      updateChatState(key, optimistic)

      // Preferred: use thefactory-tools clearChat semantics (main-process storage).
      let chat = await chatsService.clearChat(context)

      // If the chat didn't exist, clearChat can return undefined; ensure chat exists.
      if (!chat) chat = await chatsService.getChat(context)

      const state = { key, chat, isLoading: false, isThinking: false } as ChatState
      updateChatState(key, state)
      try {
        const pid = context.projectId
        if (pid) chatKeyToProjectIdRef.current[key] = pid
      } catch (_) {}
      return state
    },
    [updateChatState],
  )

  const deleteChat = useCallback(
    async (context: ChatContext) => {
      const key = getChatContextPath(context)
      // Mark as deleted BEFORE removing from state to prevent getChat from
      // auto-creating the chat when the state change triggers re-renders.
      deletedKeysRef.current.add(key)
      setChats((prev) => {
        const existing = prev[key]
        if (existing) removeFromChatsByProject(existing)
        const next = { ...prev }
        delete next[key]
        return next
      })
      try {
        delete chatKeyToProjectIdRef.current[key]
      } catch (_) {}
      try {
        clearDraft(key)
      } catch (_) {}
      await chatsService.deleteChat(context)
    },
    [removeFromChatsByProject, clearDraft],
  )

  const deleteLastMessage = useCallback(
    async (context: ChatContext) => {
      const key = getChatContextPath(context)
      const chatState = await getChat(context)
      if (chatState.isThinking) return
      try {
        const updated = await chatsService.deleteLastMessage(context)
        if (updated) updateChatState(key, { ...chatState, chat: updated })
      } catch (e) {
        console.error('Failed to delete last message', e)
      }
    },
    [getChat, updateChatState],
  )

  const getSettings = useCallback(
    (context: ChatContext): ChatSettings | undefined =>
      extractSettingsForContext(allChatSettings, context),
    [allChatSettings],
  )

  const resetSettings = useCallback(
    async (context: ChatContext): Promise<ChatSettings | undefined> => {
      try {
        const updated = await chatsService.resetChatSettings(context)
        setAllChatSettings(updated)
        return extractSettingsForContext(updated, context)
      } catch (e) {
        console.error('Failed to reset chat settings', e)
        return extractSettingsForContext(allChatSettings, context)
      }
    },
    [allChatSettings],
  )

  const updateCompletionSettings = useCallback(
    async (
      context: ChatContext,
      patch: Partial<CompletionSettings>,
    ): Promise<ChatSettings | undefined> => {
      try {
        const updated = await chatsService.updateChatCompletionSettings(context, patch)
        setAllChatSettings(updated)
        return extractSettingsForContext(updated, context)
      } catch (e) {
        console.error('Failed to update chat settings', e)
        return extractSettingsForContext(allChatSettings, context)
      }
    },
    [allChatSettings],
  )

  const getDefaultPrompt = useCallback(async (chatContext: ChatContext): Promise<string> => {
    try {
      return await chatsService.getDefaultPrompt(chatContext)
    } catch (e) {
      console.error('Failed to get default prompt', e)
      return ''
    }
  }, [])

  const getSettingsPrompt = useCallback(
    async (contextArguments: ChatContextArguments): Promise<string> => {
      try {
        return await chatsService.getSettingsPrompt(contextArguments)
      } catch (e) {
        console.error('Failed to get settings prompt', e)
        return ''
      }
    },
    [],
  )

  const updateSettingsPrompt = useCallback(
    async (context: ChatContext, prompt: string): Promise<string | undefined> => {
      try {
        const updated = await chatsService.updateSettingsPrompt(context, prompt)
        setAllChatSettings(updated)
        const s = extractSettingsForContext(updated, context)
        return s?.systemPrompt
      } catch (e) {
        console.error('Failed to update settings prompt', e)
      }
      return undefined
    },
    [],
  )

  const resetSettingsPrompt = useCallback(
    async (context: ChatContext): Promise<string | undefined> => {
      try {
        const updated = await chatsService.resetSettingsPrompt(context)
        setAllChatSettings(updated)
        const s = extractSettingsForContext(updated, context)
        return s?.systemPrompt
      } catch (e) {
        console.error('Failed to reset settings prompt', e)
      }
      return undefined
    },
    [],
  )

  const value = useMemo<ChatsContextValue>(
    () => ({
      chats,
      chatsByProjectId,

      getDraft,
      setDraft,
      clearDraft,

      sendMessage,
      resumeTools,
      retryCompletion,
      abortMessage,

      getChatIfExists,
      getChat,
      restartChat,
      deleteChat,
      deleteLastMessage,

      allChatSettings,
      getSettings,
      resetSettings,
      updateCompletionSettings,

      getDefaultPrompt,
      getSettingsPrompt,
      updateSettingsPrompt,
      resetSettingsPrompt,
    }),
    [
      chats,
      chatsByProjectId,
      getDraft,
      setDraft,
      clearDraft,
      sendMessage,
      resumeTools,
      retryCompletion,
      abortMessage,
      getChatIfExists,
      getChat,
      restartChat,
      deleteChat,
      deleteLastMessage,
      allChatSettings,
      getSettings,
      resetSettings,
      updateCompletionSettings,
      getDefaultPrompt,
      getSettingsPrompt,
      updateSettingsPrompt,
      resetSettingsPrompt,
    ],
  )

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
}

export function useChats(): ChatsContextValue {
  const ctx = useContext(ChatsContext)
  if (!ctx) throw new Error('useChats must be used within ChatsProvider')
  return ctx
}
