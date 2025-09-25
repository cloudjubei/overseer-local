import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { LLMConfig } from 'thefactory-tools'
import type { Chat, ChatMessage, ChatContext, ChatSettings } from 'src/chat/ChatsManager'
import { chatsService } from '../services/chatsService'

export type ChatsContextValue = {
  context: ChatContext
  chat?: Chat
  isLoading: boolean
  isThinking: boolean
  refresh: () => Promise<void>
  sendMessage: (message: string, config: LLMConfig, attachments?: string[]) => Promise<void>
  deleteChat: () => Promise<void>
  saveChatSettings: (settings: Partial<ChatSettings>) => Promise<ChatSettings | undefined>
  listModels: (config: LLMConfig) => Promise<string[]>
  getDefaultPrompt: () => Promise<string>
  savePrompt: (prompt: string) => Promise<void>
}

const ChatsContext = createContext<ChatsContextValue | null>(null)

export function ChatsProvider({
  context,
  children,
}: {
  context: ChatContext
  children: React.ReactNode
}) {
  const [chat, setChat] = useState<Chat | undefined>()
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isThinking, setIsThinking] = useState<boolean>(false)

  const loadChat = useCallback(async () => {
    setIsLoading(true)
    try {
      let c: Chat | undefined
      try {
        c = await chatsService.getChat(context)
      } catch (_err) {
        // If chat does not exist yet for this context, create it
        c = await chatsService.createChat(context)
      }
      setChat(c)
    } finally {
      setIsLoading(false)
    }
  }, [context])

  useEffect(() => {
    // Load (or create) the chat for this context whenever it changes
    loadChat()
  }, [loadChat])

  useEffect(() => {
    // Subscribe to global chat updates and refresh our chat if it was updated
    const unsubscribe = chatsService.subscribe((chats) => {
      if (!chat?.id) return
      const updated = chats.find((c) => c.id === chat.id)
      if (updated) {
        setChat(updated)
      }
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
    // Only depend on chat id so we resubscribe if underlying chat changes
  }, [chat?.id])

  const refresh = useCallback(async () => {
    await loadChat()
  }, [loadChat])

  const sendMessage = useCallback(
    async (message: string, config: LLMConfig, attachments?: string[]) => {
      // Ensure chat exists for context
      if (!chat) await loadChat()
      const targetChat = chat ?? (await chatsService.getChat(context))
      if (!targetChat) return

      const newMessages: ChatMessage[] = [
        {
          role: 'user',
          content: message,
          attachments: attachments && attachments.length ? attachments : undefined,
        },
      ]

      // Optimistic local update with the user message
      setChat((prev) =>
        prev
          ? {
              ...prev,
              messages: [...(prev.messages || []), ...newMessages],
            }
          : prev,
      )

      setIsThinking(true)
      try {
        await chatsService.getCompletion(context, newMessages, config)
      } finally {
        setIsThinking(false)
      }
    },
    [chat, context, loadChat],
  )

  const saveChatSettings = useCallback(
    async (settings: Partial<ChatSettings>) => {
      // Optimistic local update
      setChat((prev) =>
        prev
          ? {
              ...prev,
              settings: {
                ...(prev.settings || {}),
                ...settings,
              },
            }
          : prev,
      )
      try {
        const saved = await chatsService.saveSettings(context, settings)
        setChat((prev) => (prev ? { ...prev, settings: saved } : prev))
        return saved
      } catch (e) {
        // On error, refresh to ensure we have the server state
        await loadChat()
        return undefined
      }
    },
    [context, loadChat],
  )

  const deleteChat = useCallback(async () => {
    await chatsService.deleteChat(context)
    setChat(undefined)
  }, [context])

  const listModels = useCallback(async (config: LLMConfig): Promise<string[]> => {
    return await chatsService.listModels(config)
  }, [])

  const getDefaultPrompt = useCallback(async (): Promise<string> => {
    return await chatsService.getDefaultPrompt(context)
  }, [context])

  const savePrompt = useCallback(async (prompt: string): Promise<void> => {
    await chatsService.savePrompt(context, prompt)
    // No local state change required; consumers can call refresh if needed
  }, [context])

  const value = useMemo<ChatsContextValue>(
    () => ({
      context,
      chat,
      isLoading,
      isThinking,
      refresh,
      sendMessage,
      deleteChat,
      saveChatSettings,
      listModels,
      getDefaultPrompt,
      savePrompt,
    }),
    [
      context,
      chat,
      isLoading,
      isThinking,
      refresh,
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
