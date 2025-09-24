import { useEffect, useState } from 'react'
import { chatsService } from '../services/chatsService'
import { ServiceResult } from '../services/serviceResult'
import { LLMConfig } from 'thefactory-tools'
import { Chat, ChatMessage } from 'src/chat/ChatsManager'

export function useContextualChat(contextId?: string) {
  const [chatsById, setChatsById] = useState<Record<string, Chat>>({})
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()
  const [isThinking, setIsThinking] = useState(false)

  const update = async () => {
    if (contextId) {
      const chats = await chatsService.listChats(contextId)
      updateChatsState(chats)
    } else {
      updateChatsState([]) // clear chats if no context
    }
  }

  const updateChatsState = (chats: Chat[]) => {
    const newChatsById = chats.reduce(
      (acc, c) => {
        acc[c.id] = c
        return acc
      },
      {} as Record<string, Chat>,
    )

    setChatsById(newChatsById)

    if (!currentChatId || !newChatsById[currentChatId]) {
      const mostRecent = chats
        .slice()
        .sort((a, b) => new Date(b.updateDate).getTime() - new Date(a.updateDate).getTime())[0]
      if (mostRecent) {
        setCurrentChatId(mostRecent.id)
      } else {
        setCurrentChatId(undefined)
      }
    }
  }

  useEffect(() => {
    update()
  }, [contextId])

  const createChat = async (): Promise<Chat | undefined> => {
    if (!contextId) return undefined
    const chat = await chatsService.createChat(contextId)

    if (chat) {
      setChatsById((prev) => ({ ...prev, [chat.id]: chat }))
      setCurrentChatId(chat.id)
    }
    return chat
  }

  const deleteChat = async (chatId: string): Promise<ServiceResult> => {
    if (!contextId) return { ok: false }
    const result = await chatsService.deleteChat(contextId, chatId)
    if (result.ok) {
      const newChats = { ...chatsById }
      delete newChats[chatId]
      setChatsById(newChats)

      if (currentChatId === chatId) {
        const remainingChats = Object.values(newChats)
        const mostRecent = remainingChats
          .slice()
          .sort((a, b) => new Date(b.updateDate).getTime() - new Date(a.updateDate).getTime())[0]
        setCurrentChatId(mostRecent?.id)
      }
    }
    return result
  }

  const sendMessage = async (
    message: string,
    config: LLMConfig,
    attachments?: string[],
  ): Promise<ServiceResult> => {
    if (!contextId) return { ok: false }

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      attachments: attachments && attachments.length ? attachments : undefined,
    }

    let chat: Chat
    let targetChatId = currentChatId

    if (!targetChatId || !chatsById[targetChatId]) {
      const newChat = await createChat()
      if (!newChat) return { ok: false }
      chat = newChat
      targetChatId = chat.id
    } else {
      chat = chatsById[targetChatId]
    }

    // Optimistically update UI with user message
    const updatedChatWithUserMessage = { ...chat, messages: [...chat.messages, userMessage] }
    setChatsById((prev) => ({
      ...prev,
      [chat.id]: updatedChatWithUserMessage,
    }))

    setIsThinking(true)
    try {
      const result = await chatsService.getCompletion(contextId, chat.id, [userMessage], config)

      if (result.ok) {
        const updatedChatFromServer = await chatsService.getChat(contextId, chat.id)
        if (updatedChatFromServer) {
          setChatsById((prev) => ({ ...prev, [updatedChatFromServer.id]: updatedChatFromServer }))
        }
      }

      return result
    } finally {
      setIsThinking(false)
    }
  }

  return {
    currentChatId,
    setCurrentChatId,
    chatsById,
    createChat,
    deleteChat,
    sendMessage,
    isThinking,
  }
}
