import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type {
  LLMConfig,
  ChatContext,
  Chat,
  ChatMessage,
  // ChatContextProject,
  // ChatContextStory,
  // ChatContextFeature,
  // ChatContextAgentRun,
  // ChatContextProjectTopic,
} from 'thefactory-tools'
import { getChatContextPath } from 'thefactory-tools'
import { chatsService } from '../services/chatsService'
import { projectsService } from '../services/projectsService'

//TODO: this two methods should be available to import
export function getChatsProjectsFolder(projectId: string) {
  return '/projects/' + projectId
}
// export function getChatContextPath(context: ChatContext): string {
//   switch (context.type) {
//     case 'PROJECT': {
//       const c = context as ChatContextProject
//       return `${getChatsProjectsFolder(c.projectId)}.json`
//     }
//     case 'STORY': {
//       const c = context as ChatContextStory
//       return `${getChatsProjectsFolder(c.projectId)}/stories/${c.storyId}.json`
//     }
//     case 'FEATURE': {
//       const c = context as ChatContextFeature
//       return `${getChatsProjectsFolder(c.projectId)}/stories/${c.storyId}/features/${c.featureId}.json`
//     }
//     case 'AGENT_RUN': {
//       const c = context as ChatContextAgentRun
//       return `${getChatsProjectsFolder(c.projectId)}/stories/${c.storyId}/agents/${c.agentRunId}.json`
//     }
//     case 'PROJECT_TOPIC': {
//       const c = context as ChatContextProjectTopic
//       return `${getChatsProjectsFolder(c.projectId)}/${c.projectTopic}.json`
//     }
//   }
//   return `general_${context.timestamp!}.json`
// }

export type ChatState = {
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
    config: LLMConfig,
    attachments?: string[],
  ) => Promise<void>

  getChat: (context: ChatContext) => Promise<ChatState>
  restartChat: (context: ChatContext) => Promise<ChatState>
  deleteChat: (context: ChatContext) => Promise<void>
}

const ChatsContext = createContext<ChatsContextValue | null>(null)

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<Record<string, ChatState>>({})
  const [chatsByProjectId, setChatsByProjectId] = useState<Record<string, ChatState[]>>({})

  const updateChatState = useCallback((key: string, updates: Partial<ChatState>) => {
    setChats((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { isLoading: false, isThinking: false }),
        ...updates,
      },
    }))
  }, [])

  // load all chats on startup
  useEffect(() => {
    const loadAllChats = async () => {
      try {
        const projects = await projectsService.listProjects()
        const chatsByProjectId: Record<string, ChatState[]> = {}
        const allChats: Record<string, ChatState> = {}
        for (const project of projects) {
          let projectChats = []
          try {
            projectChats = await chatsService.listChats(project.id)
            const chatStates: ChatState[] = projectChats.map((chat) => {
              return { chat, isLoading: false, isThinking: false }
            })
            chatsByProjectId[project.id] = chatStates
            for (const c of chatStates) {
              allChats[getChatContextPath(c.chat.context)] = c
            }
          } catch (e) {
            console.error(`Failed to list chats for project ${project.id}`, e)
          }
        }
        setChats(allChats)
        setChatsByProjectId(chatsByProjectId)
      } catch (e) {
        console.error('Failed to load projects to load chats', e)
      }
    }
    loadAllChats()
  }, [])

  useEffect(() => {
    const unsubscribe = chatsService.subscribe((updatedChats: Chat[]) => {
      setChats((prev) => {
        const newChats = { ...prev }
        for (const chat of updatedChats) {
          const key = getChatContextPath(chat.context)
          newChats[key] = {
            ...(newChats[key] || {}),
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

  const getChat = useCallback(
    async (context: ChatContext): Promise<ChatState> => {
      const key = getChatContextPath(context)
      const c = chats[key]
      if (c) return c
      const chat = await chatsService.getChat(context)
      const chatState: ChatState = { chat, isLoading: false, isThinking: false }
      updateChatState(key, chatState)
      return chatState
    },
    [chats],
  )

  const sendMessage = useCallback(
    async (context: ChatContext, message: string, config: LLMConfig, files?: string[]) => {
      const key = getChatContextPath(context)
      const chatState = await getChat(context)

      const newMessages: ChatMessage[] = [
        {
          completionMesage: {
            role: 'user',
            content: message,
            files: files && files.length ? files : undefined,
          },
        },
      ]

      // Optimistic local update with the user message
      updateChatState(key, {
        chat: { ...chatState.chat, messages: [...chatState.chat.messages, ...newMessages] },
        isThinking: true,
      })

      try {
        await chatsService.getCompletion(context, newMessages, config)
      } finally {
        updateChatState(key, { isThinking: false })
      }
    },
    [chats, updateChatState],
  )

  const restartChat = useCallback(async (context: ChatContext): Promise<ChatState> => {
    const key = getChatContextPath(context)
    // Optimistic replace in local state
    const now = new Date().toISOString()
    updateChatState(key, {
      chat: { context, messages: [], createdAt: now, updatedAt: now },
      isLoading: false,
      isThinking: false,
    })
    const chat = await chatsService.createChat(context)
    const state = { chat, isLoading: false, isThinking: false }
    updateChatState(key, state)
    return state
  }, [])

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

  const value = useMemo<ChatsContextValue>(
    () => ({
      chats,
      chatsByProjectId,
      sendMessage,
      getChat,
      restartChat,
      deleteChat,
    }),
    [chats, chatsByProjectId, sendMessage, getChat, restartChat, deleteChat],
  )
  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
}

export function useChats(): ChatsContextValue {
  const ctx = useContext(ChatsContext)
  if (!ctx) throw new Error('useChats must be used within ChatsProvider')
  return ctx
}
