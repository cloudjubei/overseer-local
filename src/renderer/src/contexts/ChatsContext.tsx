import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type {
  LLMConfig,
  ChatContext,
  Chat,
  ChatMessage,
  ChatUpdate,
  ChatsSettings,
  ChatSettings,
  ChatContextArguments,
  CompletionMessage,
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

export type ChatsContextValue = {
  chats: Record<string, ChatState>
  chatsByProjectId: Record<string, ChatState[]>

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
  // Track last assistant message index notified per chat key to avoid duplicates
  const lastAssistantNotifiedRef = useRef<Record<string, number>>({})

  const updateChatState = useCallback((key: string, updates: Partial<ChatState>) => {
    setChats((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { isLoading: false, isThinking: false }),
        ...updates,
      },
    }))
  }, [])

  // Helper: safely update chatsByProjectId for a given chat state
  const upsertChatsByProject = useCallback((chatState: ChatState) => {
    const ctx = chatState.chat.context
    const pid = (ctx as any).projectId as string | undefined
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
    const pid = (ctx as any).projectId as string | undefined
    if (!pid) return
    setChatsByProjectId((prev) => {
      const existing = prev[pid] || []
      const nextForProject = existing.filter((c) => c.key !== chatState.key)
      if (nextForProject === existing) return prev
      return { ...prev, [pid]: nextForProject }
    })
  }, [])

  // load all chats and settings on startup
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
            for (const c of chatStates) all[c.key] = c
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
    loadAll()
  }, [])

  useEffect(() => {
    const unsubscribe = chatsService.subscribe((chatUpdate: ChatUpdate) => {
      setChats((prev) => {
        const newChats = { ...prev }
        const key = getChatContextPath(chatUpdate.context)
        if (chatUpdate.type === 'delete') {
          const existing = newChats[key]
          if (existing) {
            // Remove from project mapping first
            removeFromChatsByProject(existing)
          }
          delete newChats[key]
        } else if (chatUpdate.type === 'change') {
          const next: ChatState = {
            ...(newChats[key] || { key, isLoading: false, isThinking: false, chat: chatUpdate.chat! }),
            chat: chatUpdate.chat!,
          }
          newChats[key] = next
          upsertChatsByProject(next)

          // Fire OS notification for new assistant messages (debounced per chat)
          try {
            const msgs = chatUpdate.chat?.messages || []
            // find last assistant message index
            let lastAssistantIdx = -1
            for (let i = msgs.length - 1; i >= 0; i--) {
              const role = (msgs[i] as any)?.completionMessage?.role
              if (role === 'assistant') {
                lastAssistantIdx = i
                break
              }
            }
            if (lastAssistantIdx >= 0) {
              const prevIdx = lastAssistantNotifiedRef.current[key] ?? -1
              if (lastAssistantIdx > prevIdx) {
                lastAssistantNotifiedRef.current[key] = lastAssistantIdx

                // Build notification content
                const ctx: any = chatUpdate.context as any
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
                const raw = String((msgs[lastAssistantIdx] as any)?.completionMessage?.content || '')
                const snippet = raw.replace(/\s+/g, ' ').slice(0, 120)
                const message = snippet || 'Assistant responded'

                // Deep link to specific chat context
                const enc = encodeURIComponent
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

                const pid = ctx.projectId || projectId
                if (pid) {
                  void notificationsService
                    .create(pid, {
                      type: 'info',
                      category: 'chat',
                      title,
                      message,
                      metadata: { actionUrl },
                    })
                    .catch(() => {})
                }
              }
            }
          } catch (_) {
            // no-op
          }
        } else {
          const next: ChatState = { key, chat: chatUpdate.chat!, isLoading: false, isThinking: false }
          newChats[key] = next
          upsertChatsByProject(next)
        }
        return newChats
      })
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [upsertChatsByProject, removeFromChatsByProject, projectId])

  const getChat = useCallback(
    async (context: ChatContext): Promise<ChatState> => {
      const key = getChatContextPath(context)
      const c = chats[key]
      if (c) return c
      const chat = await chatsService.getChat(context)
      const chatState: ChatState = { key, chat, isLoading: false, isThinking: false }
      updateChatState(key, chatState)
      // also ensure project mapping is updated
      upsertChatsByProject(chatState)
      return chatState
    },
    [chats, updateChatState, upsertChatsByProject],
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
      const completionMessage: CompletionMessage = {
        role: 'user',
        content: message,
        files: files && files.length ? files : undefined,
      }

      // Optimistic local update with the user message
      const key = getChatContextPath(context)
      const chatState = await getChat(context)

      // DO NOT ALLOW MULTI MESSAGES WHILE AGENT IS THINKING
      if (chatState.isThinking) return

      const now = new Date().toISOString()
      const m: ChatMessage = {
        completionMessage: {
          ...completionMessage,
          usage: { promptTokens: 0, completionTokens: 0 },
          startedAt: now,
          completedAt: now,
          durationMs: 0,
        },
      }
      const chatMessages = [...chatState.chat.messages, m]
      const nextState: ChatState = {
        ...chatState,
        chat: {
          ...chatState.chat,
          messages: chatMessages,
        },
        isThinking: true,
      }
      updateChatState(key, nextState)
      upsertChatsByProject(nextState)

      const chatProjectId = context.projectId ?? projectId
      try {
        await completionService.sendCompletionTools(
          chatProjectId,
          context,
          completionMessage,
          prompt,
          settings.completionSettings,
          config,
        )
      } catch (e) {
        console.error('completionService.getCompletionTools:', e)
      } finally {
        updateChatState(key, { isThinking: false })
      }
    },
    [projectId, getChat, updateChatState, upsertChatsByProject],
  )

  const resumeTools = useCallback(
    async (
      context: ChatContext,
      toolsGranted: string[],
      prompt: string,
      settings: ChatSettings,
      config: LLMConfig,
    ) => {
      // Optimistic local update with the user message
      const key = getChatContextPath(context)
      const chatState = await getChat(context)

      // DO NOT ALLOW  WHILE AGENT IS THINKING
      if (chatState.isThinking) return

      const nextState: ChatState = {
        ...chatState,
        chat: {
          ...chatState.chat,
        },
        isThinking: true,
      }
      updateChatState(key, nextState)
      upsertChatsByProject(nextState)

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
    [projectId, getChat, updateChatState, upsertChatsByProject],
  )

  const retryCompletion = useCallback(
    async (
      context: ChatContext,
      prompt: string,
      settings: ChatSettings,
      config: LLMConfig,
    ) => {
      const key = getChatContextPath(context)
      const chatState = await getChat(context)
      if (chatState.isThinking) return

      const nextState: ChatState = {
        ...chatState,
        chat: {
          ...chatState.chat,
        },
        isThinking: true,
      }
      updateChatState(key, nextState)
      upsertChatsByProject(nextState)

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
    [projectId, getChat, updateChatState, upsertChatsByProject],
  )

  const abortMessage = useCallback(
    async (context: ChatContext) => {
      try {
        await completionService.abortCompletion(context)
      } catch (e) {
        console.warn('Abort failed or not available for chat', e)
      }
    },
    [chats],
  )

  const restartChat = useCallback(
    async (context: ChatContext): Promise<ChatState> => {
      const key = getChatContextPath(context)
      // Optimistic replace in local state
      const now = new Date().toISOString()
      const optimistic: ChatState = {
        key,
        chat: { context, messages: [], createdAt: now, updatedAt: now },
        isLoading: false,
        isThinking: false,
      }
      updateChatState(key, optimistic)
      upsertChatsByProject(optimistic)

      const chat = await chatsService.createChat({ context, messages: [] })
      const state = { key, chat, isLoading: false, isThinking: false } as ChatState
      updateChatState(key, state)
      upsertChatsByProject(state)
      return state
    },
    [updateChatState, upsertChatsByProject],
  )

  const deleteChat = useCallback(async (context: ChatContext) => {
    const key = getChatContextPath(context)
    // Optimistic removal from local state
    setChats((prev) => {
      const existing = prev[key]
      if (existing) {
        removeFromChatsByProject(existing)
      }
      const newState = { ...prev }
      delete newState[key]
      return newState
    })
    await chatsService.deleteChat(context)
  }, [removeFromChatsByProject])

  const deleteLastMessage = useCallback(async (context: ChatContext) => {
    const key = getChatContextPath(context)
    const chatState = await getChat(context)

    // Do not allow deletion while assistant is thinking
    if (chatState.isThinking) return

    try {
      const updated = await chatsService.deleteLastMessage(context)
      if (updated) {
        const nextState: ChatState = { ...chatState, chat: updated }
        updateChatState(key, nextState)
        upsertChatsByProject(nextState)
      }
    } catch (e) {
      console.error('Failed to delete last message', e)
      // No state mutation here; rely on subscription to reconcile
    }
  }, [getChat, updateChatState, upsertChatsByProject])

  const getSettings = useCallback(
    (context: ChatContext): ChatSettings | undefined => {
      return extractSettingsForContext(allChatSettings, context)
    },
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
        console.error('Failed to get settings prompt', e)
      }
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
        console.error('Failed to get settings prompt', e)
      }
    },
        [],
  )

  const value = useMemo<ChatsContextValue>(
    () => ({
      chats,
      chatsByProjectId,
      sendMessage,
      resumeTools,
      retryCompletion,
      abortMessage,
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
      sendMessage,
      resumeTools,
      retryCompletion,
      abortMessage,
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
