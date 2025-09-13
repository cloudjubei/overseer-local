import { useEffect, useState } from 'react'
import { chatsService } from '../services/chatsService'
import { useActiveProject } from '../contexts/ProjectContext'
import { Chat, ChatMessage } from '../services/chatsService'
import { ServiceResult } from '../services/serviceResult'
import { LLMConfig } from 'thefactory-tools'

export function useChats() {
  const { project } = useActiveProject()

  const [chatsById, setChatsById] = useState<Record<string, Chat>>({})
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()

  const update = async () => {
    if (project) {
      const chats = await chatsService.listChats(project.id)
      updateCurrentProjectChats(chats)
    }
  }

  const updateCurrentProjectChats = (chats: Chat[]) => {
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
  }

  useEffect(() => {
    update()

    const unsubscribe = chatsService.subscribe(updateCurrentProjectChats)

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    update()
  }, [project])

  const createChat = async (): Promise<Chat | undefined> => {
    if (!project) return undefined
    const chat = await chatsService.createChat(project.id)

    if (chat) {
      setCurrentChatId(chat.id)
    }
    // await update();
    return chat
  }

  const deleteChat = async (chatId: string): Promise<ServiceResult> => {
    if (project) {
      return await chatsService.deleteChat(project.id, chatId)
    }
    return { ok: false }
  }

  const sendMessage = async (
    message: string,
    config: LLMConfig,
    attachments?: string[],
  ): Promise<ServiceResult> => {
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
      chat = await chatsService.createChat(project.id)
      if (!chat) return { ok: false }
      targetChatId = chat.id
      setCurrentChatId(targetChatId)
    } else {
      chat = chatsById[targetChatId]
    }
    setChatsById((prev) => {
      return {
        ...prev,
        [chat.id]: { ...chat, messages: [...chat.messages, ...newMessages] },
      }
    })

    return await chatsService.getCompletion(project.id, chat.id, newMessages, config)
  }

  const listModels = async (config: LLMConfig): Promise<string[]> => {
    return await chatsService.listModels(config)
  }

  return {
    currentChatId,
    setCurrentChatId,
    chatsById,
    createChat,
    deleteChat,
    sendMessage,
    listModels,
  }
}
