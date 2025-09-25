import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useActiveProject } from './ProjectContext'
import type { ServiceResult } from '../services/serviceResult'
import type { LLMConfig } from 'thefactory-tools'
import type { Chat, ChatMessage } from 'src/chat/ChatsManager'
import { chatsService as typedChatsService } from '../services/chatsService'

// Note: The preload API currently uses projectId/chatId for some methods.
// To maintain compatibility with existing ChatView, we coerce calls via any-cast where needed.
const rawChatsService: any = (typedChatsService as unknown) as any

export type ChatsContextValue = {
  currentChatId?: string
  setCurrentChatId: (id?: string) => void
  chatsById: Record<string, Chat>
  createChat: () => Promise<Chat | undefined>
  deleteChat: (chatId: string) => Promise<ServiceResult>
  sendMessage: (message: string, config: LLMConfig, attachments?: string[]) => Promise<ServiceResult>
  listModels: (config: LLMConfig) => Promise<string[]>
  isThinking: boolean
}

const ChatsContext = createContext<ChatsContextValue | null>(null)

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const { project } = useActiveProject()

  const [chatsById, setChatsById] = useState<Record<string, Chat>>({})
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()
  const [isThinking, setIsThinking] = useState(false)

  const updateCurrentProjectChats = useCallback((chats: Chat[]) => {
    const newChats = chats.reduce((acc, c) => {
      acc[c.id] = c
      return acc
    }, {} as Record<string, Chat>)

    setChatsById(newChats)

    if (!currentChatId || !newChats[currentChatId]) {
      const mostRecent = chats
        .slice()
        .sort((a, b) => new Date(b.updateDate).getTime() - new Date(a.updateDate).getTime())[0]
      if (mostRecent) setCurrentChatId(mostRecent.id)
    }
  }, [currentChatId])

  const update = useCallback(async () => {
    if (project) {
      const chats = await rawChatsService.listChats(project.id)
      updateCurrentProjectChats(chats)
    }
  }, [project, updateCurrentProjectChats])

  useEffect(() => {
    update()
    const unsubscribe = rawChatsService.subscribe(updateCurrentProjectChats)
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  useEffect(() => {
    update()
  }, [project, update])

  const createChat = useCallback(async (): Promise<Chat | undefined> => {
    if (!project) return undefined
    const chat: Chat | undefined = await rawChatsService.createChat(project.id)
    if (chat) {
      setCurrentChatId(chat.id)
    }
    return chat
  }, [project])

  const deleteChat = useCallback(async (chatId: string): Promise<ServiceResult> => {
    if (project) {
      return await rawChatsService.deleteChat(project.id, chatId)
    }
    return { ok: false }
  }, [project])

  const sendMessage = useCallback(
    async (message: string, config: LLMConfig, attachments?: string[]): Promise<ServiceResult> => {
      if (!project) return { ok: false }

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
        chat = await rawChatsService.createChat(project.id)
        if (!chat) return { ok: false }
        targetChatId = chat.id
        setCurrentChatId(targetChatId)
      } else {
        chat = chatsById[targetChatId]
      }

      setChatsById((prev) => {
        return {
          ...prev,
          [chat.id]: { ...chat, messages: [...(chat.messages || []), ...newMessages] },
        }
      })

      setIsThinking(true)
      try {
        return await rawChatsService.getCompletion(project.id, chat.id, newMessages, config)
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
      listModels,
      isThinking,
    }),
    [currentChatId, chatsById, createChat, deleteChat, sendMessage, listModels, isThinking],
  )

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
}

export function useChats(): ChatsContextValue {
  const ctx = useContext(ChatsContext)
  if (!ctx) throw new Error('useChats must be used within ChatsProvider')
  return ctx
}
