import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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

export type ChatState = {
  key: string
  chat: Chat
  isLoading: boolean
  isThinking: boolean
  abortController?: AbortController
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
    abortSignal?: AbortSignal,
  ) => Promise<void>

  getChat: (context: ChatContext) => Promise<ChatState>
  restartChat: (context: ChatContext) => Promise<ChatState>
  deleteChat: (context: ChatContext) => Promise<void>

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

  const updateChatState = useCallback((key: string, updates: Partial<ChatState>) => {
    setChats((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { isLoading: false, isThinking: false }),
        ...updates,
      },
    }))
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
          delete newChats[key]
        } else if (chatUpdate.type === 'change') {
          newChats[key] = {
            ...(newChats[key] || { isLoading: false, isThinking: false }),
            chat: chatUpdate.chat!,
          }
        } else {
          newChats[key] = { key, chat: chatUpdate.chat!, isLoading: false, isThinking: false }
        }
        return newChats
      })
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const getChat = useCallback(
    async (context: ChatContext): Promise<ChatState> => {
      const key = getChatContextPath(context)
      const c = chats[key]
      if (c) return c
      const chat = await chatsService.getChat(context)
      const chatState: ChatState = { key, chat, isLoading: false, isThinking: false }
      updateChatState(key, chatState)
      return chatState
    },
    [chats, updateChatState],
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

      //DO NOT ALLOW MULTI MESSAGES WHILE AGENT IS THINKING
      if (chatState.isThinking) return

      const now = new Date().toISOString()
      const m: ChatMessage = {
        completionMessage: {
          ...completionMessage,
          usage: { promptTokens: 0, completionTokens: 0 },
          askedAt: now,
          completedAt: now,
          durationMs: 0,
        },
      }
      const chatMessages = [...chatState.chat.messages, m]
      updateChatState(key, {
        chat: {
          ...chatState.chat,
          messages: chatMessages,
        },
        isThinking: true,
      })

      const chatProjectId = context.projectId ?? projectId
      try {
        console.log('completionService.getCompletionTools')
        await completionService.getCompletionTools(
          chatProjectId,
          context,
          completionMessage,
          prompt,
          settings.completionSettings,
          config,
          // onAbortControllerCreated,
        )
        console.log('ChatsContext finished completionService.getCompletionTools')
      } catch (e) {
        console.error('completionService.getCompletionTools:', e)
      } finally {
        updateChatState(key, { isThinking: false })
      }
    },
    [projectId, getChat, updateChatState],
  )

  const restartChat = useCallback(
    async (context: ChatContext): Promise<ChatState> => {
      const key = getChatContextPath(context)
      // Optimistic replace in local state
      const now = new Date().toISOString()
      updateChatState(key, {
        chat: { context, messages: [], createdAt: now, updatedAt: now },
        isLoading: false,
        isThinking: false,
      })
      const chat = await chatsService.createChat({ context, messages: [] })
      const state = { key, chat, isLoading: false, isThinking: false }
      updateChatState(key, state)
      return state
    },
    [updateChatState],
  )

  const deleteChat = useCallback(async (context: ChatContext) => {
    const key = getChatContextPath(context)
    // Optimistic removal from local state
    setChats((prev) => {
      const newState = { ...prev }
      delete newState[key]
      return newState
    })
    await chatsService.deleteChat(context)
  }, [])

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
      getChat,
      restartChat,
      deleteChat,
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
      getChat,
      restartChat,
      deleteChat,
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
