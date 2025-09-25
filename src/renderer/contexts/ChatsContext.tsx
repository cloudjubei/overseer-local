import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { LLMConfig } from 'thefactory-tools'
import type { Chat, ChatMessage, ChatContext, ChatSettings } from 'src/chat/ChatsManager'
import { chatsService } from '../services/chatsService'
import { projectsService } from '../services/projectsService'

// Helper to create a stable key from a ChatContext
const getContextKey = (context: ChatContext): string => {
  switch (context.type) {
    case 'project':
      return context.projectId
    case 'story':
      return `${context.projectId}/${context.storyId}`
    case 'feature':
      return `${context.projectId}/${context.storyId}/${context.featureId}`
    case 'project_tests':
      return `${context.projectId}/tests`
    case 'project_agents':
      return `${context.projectId}/agents`
    default:
      // This is a fallback and might not be stable if object keys change order.
      // However, ChatContext is a discriminated union, so the existing cases should cover everything.
      return JSON.stringify(context)
  }
}

// State for each chat
export type ChatState = {
  chat?: Chat
  isLoading: boolean
  isThinking: boolean
}

export type ChatsContextValue = {
  getChatState: (context: ChatContext) => ChatState
  refreshChat: (context: ChatContext) => Promise<void>
  sendMessage: (
    context: ChatContext,
    message: string,
    config: LLMConfig,
    attachments?: string[],
  ) => Promise<void>
  deleteChat: (context: ChatContext) => Promise<void>
  saveChatSettings: (
    context: ChatContext,
    settings: Partial<ChatSettings>,
  ) => Promise<ChatSettings | undefined>
  listModels: (config: LLMConfig) => Promise<string[]>
  getDefaultPrompt: (context: ChatContext) => Promise<string>
  savePrompt: (context: ChatContext, prompt: string) => Promise<void>
}

const ChatsContext = createContext<ChatsContextValue | null>(null)

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<Record<string, ChatState>>({})

  const updateChatState = useCallback((key: string, updates: Partial<ChatState>) => {
    setChats((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { isLoading: false, isThinking: false }),
        ...updates,
      },
    }))
  }, [])

  const loadChat = useCallback(
    async (context: ChatContext): Promise<Chat | undefined> => {
      const key = getContextKey(context)
      updateChatState(key, { isLoading: true })
      try {
        let c: Chat | undefined
        try {
          c = await chatsService.getChat(context)
        } catch (_err) {
          // If chat does not exist yet for this context, create it
          c = await chatsService.createChat(context)
        }
        updateChatState(key, { chat: c, isLoading: false })
        return c
      } catch (err) {
        updateChatState(key, { isLoading: false })
        console.error(`Failed to load chat for context ${key}:`, err)
        return undefined
      }
    },
    [updateChatState],
  )

  // Effect to load all chats on startup
  useEffect(() => {
    const loadAllChats = async () => {
      try {
        const projects = await projectsService.listProjects()
        const allChats: Chat[] = []
        for (const project of projects) {
          try {
            const projectChats = await chatsService.listChats(project.id)
            allChats.push(...projectChats)
          } catch (e) {
            console.error(`Failed to list chats for project ${project.id}`, e)
          }
        }

        setChats((prev) => {
          const newChatsState: Record<string, ChatState> = {}
          for (const chat of allChats) {
            newChatsState[chat.id] = {
              chat,
              isLoading: prev[chat.id]?.isLoading ?? false,
              isThinking: prev[chat.id]?.isThinking ?? false,
            }
          }
          return newChatsState
        })
      } catch (e) {
        console.error('Failed to load projects to load chats', e)
      }
    }
    loadAllChats()
  }, [])

  // Effect to subscribe to chat updates
  useEffect(() => {
    const unsubscribe = chatsService.subscribe((updatedChats: Chat[]) => {
      setChats((prev) => {
        const newChats = { ...prev }
        for (const chat of updatedChats) {
          newChats[chat.id] = {
            ...(newChats[chat.id] || {}),
            chat: chat,
            isLoading: false,
            isThinking: false,
          }
        }
        return newChats
      })
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const getChatState = useCallback(
    (context: ChatContext): ChatState => {
      const key = getContextKey(context)
      return chats[key] || { chat: undefined, isLoading: false, isThinking: false }
    },
    [chats],
  )

  const refreshChat = useCallback(
    async (context: ChatContext) => {
      await loadChat(context)
    },
    [loadChat],
  )

  const sendMessage = useCallback(
    async (context: ChatContext, message: string, config: LLMConfig, attachments?: string[]) => {
      const key = getContextKey(context)
      let chat = chats[key]?.chat
      if (!chat) {
        chat = await loadChat(context)
      }
      if (!chat) return

      const newMessages: ChatMessage[] = [
        {
          role: 'user',
          content: message,
          attachments: attachments && attachments.length ? attachments : undefined,
        },
      ]

      // Optimistic local update with the user message
      updateChatState(key, {
        chat: { ...chat, messages: [...(chat.messages || []), ...newMessages] },
        isThinking: true,
      })

      try {
        await chatsService.getCompletion(context, newMessages, config)
      } finally {
        // The thinking state will be cleared by the subscription update upon completion.
        // If there's an error, this ensures we don't get stuck in a thinking state.
        updateChatState(key, { isThinking: false })
      }
    },
    [chats, loadChat, updateChatState],
  )

  const saveChatSettings = useCallback(
    async (context: ChatContext, settings: Partial<ChatSettings>) => {
      const key = getContextKey(context)

      // Optimistic local update
      if (chats[key]?.chat) {
        const chat = chats[key].chat!
        updateChatState(key, {
          chat: { ...chat, settings: { ...(chat.settings || {}), ...settings } },
        })
      }

      try {
        return await chatsService.saveSettings(context, settings)
      } catch (e) {
        // On error, refresh to ensure we have the server state
        await loadChat(context)
        return undefined
      }
    },
    [chats, loadChat, updateChatState],
  )

  const deleteChat = useCallback(
    async (context: ChatContext) => {
      const key = getContextKey(context)
      await chatsService.deleteChat(context)
      // Optimistic removal from local state
      setChats((prev) => {
        const newState = { ...prev }
        delete newState[key]
        return newState
      })
    },
    [],
  )

  const listModels = useCallback(async (config: LLMConfig): Promise<string[]> => {
    return await chatsService.listModels(config)
  }, [])

  const getDefaultPrompt = useCallback(async (context: ChatContext): Promise<string> => {
    return await chatsService.getDefaultPrompt(context)
  }, [])

  const savePrompt = useCallback(async (context: ChatContext, prompt: string): Promise<void> => {
    await chatsService.savePrompt(context, prompt)
    // No local state change required; consumers can call refresh if needed
  }, [])

  const value = useMemo<ChatsContextValue>(
    () => ({
      getChatState,
      refreshChat,
      sendMessage,
      deleteChat,
      saveChatSettings,
      listModels,
      getDefaultPrompt,
      savePrompt,
    }),
    [
      getChatState,
      refreshChat,
      sendMessage,
      deleteChat,
      saveChatSettings,
      listModels,
      getDefaultPrompt,
      savePrompt,
    ],
  )

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
}

export function useChats(): ChatsContextValue {
  const ctx = useContext(ChatsContext)
  if (!ctx) throw new Error('useChats must be used within ChatsProvider')
  return ctx
}
