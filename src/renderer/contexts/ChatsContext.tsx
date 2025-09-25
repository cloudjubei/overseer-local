import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useActiveProject } from './ProjectContext'
import type { LLMConfig } from 'thefactory-tools'
import type { Chat, ChatMessage, ChatContext, ChatSettings } from 'src/chat/ChatsManager'
import { chatsService as typedChatsService } from '../services/chatsService'

export type ChatsContextValue = {
  currentChatId?: string
  setCurrentChatId: (id?: string) => void
  chatsById: Record<string, Chat>
  createChat: () => Promise<Chat | undefined>
  deleteChat: (chatId: string) => Promise<void>
  sendMessage: (message: string, config: LLMConfig, attachments?: string[]) => Promise<void>
  saveChatSettings: (
    chatId: string,
    settings: Partial<ChatSettings>,
  ) => Promise<ChatSettings | undefined>
  listModels: (config: LLMConfig) => Promise<string[]>
  isThinking: boolean
}

const ChatsContext = createContext<ChatsContextValue | null>(null)

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const { project } = useActiveProject()

  const [chatsById, setChatsById] = useState<Record<string, Chat>>({})
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()
  const [isThinking, setIsThinking] = useState(false)

  const updateCurrentProjectChats = useCallback(
    (chats: Chat[]) => {
      const newChats = chats.reduce(
        (acc, c) => {
          acc[c.id] = c
          return acc
        },
        {} as Record<string, Chat>,
      )

      setChatsById(newChats)

      if (!currentChatId || !newChats[currentChatId]) {
        const mostRecent = chats
          .slice()
          .sort((a, b) => new Date(b.updateDate).getTime() - new Date(a.updateDate).getTime())[0]
        if (mostRecent) setCurrentChatId(mostRecent.id)
      }
    },
    [currentChatId],
  )

  const update = useCallback(async () => {
    if (project) {
      const chats = await typedChatsService.listChats(project.id)
      updateCurrentProjectChats(chats)
    }
  }, [project, updateCurrentProjectChats])

  useEffect(() => {
    update()
    const unsubscribe = typedChatsService.subscribe(updateCurrentProjectChats)
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  useEffect(() => {
    update()
  }, [project, update])

  const createChat = useCallback(async (): Promise<Chat | undefined> => {
    if (!project) return undefined
    const chat: Chat | undefined = await typedChatsService.createChat({ projectId: project.id })
    if (chat) {
      setCurrentChatId(chat.id)
    }
    return chat
  }, [project])

  const deleteChat = useCallback(
    async (chatId: string): Promise<void> => {
      const chat = chatsById[chatId]
      if (project && chat && chat.context) {
        return await typedChatsService.deleteChat(chat.context)
      }
    },
    [project, chatsById],
  )

  const saveChatSettings = useCallback(
    async (chatId: string, settings: Partial<ChatSettings>) => {
      const chat = chatsById[chatId]
      if (!project || !chat || !chat.context) return

      setChatsById((prev) => ({
        ...prev,
        [chatId]: {
          ...prev[chatId],
          settings: {
            ...(prev[chatId].settings || {}),
            ...settings,
          },
        },
      }))

      return await typedChatsService.saveSettings(chat.context, settings)
    },
    [project, chatsById],
  )

  const sendMessage = useCallback(
    async (message: string, config: LLMConfig, attachments?: string[]): Promise<void> => {
      if (!project) return

      const newMessages: ChatMessage[] = [
        {
          role: 'user',
          content: message,
          attachments: attachments && attachments.length ? attachments : undefined,
        },
      ]

      let chat: Chat
      let targetChatId = currentChatId
      if (!targetChatId || !chatsById[targetChatId]) {
        chat = await typedChatsService.createChat({ projectId: project.id })
        if (!chat) return
        targetChatId = chat.id
        setCurrentChatId(targetChatId)
      } else {
        chat = chatsById[targetChatId]
      }

      if (!chat.context) return

      setChatsById((prev) => {
        return {
          ...prev,
          [chat.id]: { ...chat, messages: [...(chat.messages || []), ...newMessages] },
        }
      })

      setIsThinking(true)
      try {
        return await typedChatsService.getCompletion(chat.context, newMessages, config)
      } finally {
        setIsThinking(false)
      }
    },
    [project, currentChatId, chatsById],
  )

  const listModels = useCallback(async (config: LLMConfig): Promise<string[]> => {
    return await typedChatsService.listModels(config)
  }, [])

  const value = useMemo<ChatsContextValue>(
    () => ({
      currentChatId,
      setCurrentChatId,
      chatsById,
      createChat,
      deleteChat,
      sendMessage,
      saveChatSettings,
      listModels,
      isThinking,
    }),
    [
      currentChatId,
      chatsById,
      createChat,
      deleteChat,
      sendMessage,
      saveChatSettings,
      listModels,
      isThinking,
    ],
  )

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
}

export function useChats(): ChatsContextValue {
  const ctx = useContext(ChatsContext)
  if (!ctx) throw new Error('useChats must be used within ChatsProvider')
  return ctx
}
