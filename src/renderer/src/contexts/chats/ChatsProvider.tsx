import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChatContext,
  ChatContextArguments,
  ChatsSettings,
  ChatSettings,
  CompletionSettings,
  LLMConfig,
} from 'thefactory-tools'
import { getChatContextKey } from 'thefactory-tools/utils'

import { chatsService } from '@renderer/services/chatsService'
import { projectsService } from '@renderer/services/projectsService'
import { completionService } from '@renderer/services/completionService'
import { notificationsService } from '@renderer/services/notificationsService'
import { useActiveProject } from '@renderer/contexts/ProjectContext'

import type { ChatsContextValue, ChatState } from './ChatsTypes'
import { useChatDrafts } from './ChatsDrafts'
import { extractSettingsForContext } from './ChatsSettings'
import { ChatsContext } from './ChatsContext'

function toProjectIndex(chats: Record<string, ChatState>): Record<string, ChatState[]> {
  console.log('toProjectIndex chats: ', chats)
  const byProject: Record<string, ChatState[]> = {}
  for (const key of Object.keys(chats)) {
    const st = chats[key]
    const pid = st.chat.context.projectId || 'unknown'
    if (!byProject[pid]) byProject[pid] = []
    byProject[pid].push(st)
  }
  return byProject
}

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useActiveProject()
  const { getDraft, setDraft, clearDraft } = useChatDrafts()

  const [chats, setChats] = useState<Record<string, ChatState>>({})
  const chatsByProjectId = useMemo(() => toProjectIndex(chats), [chats])

  const [allChatSettings, setAllChatSettings] = useState<ChatsSettings | undefined>(undefined)

  // Track last assistant message index we've notified for each chat key.
  const lastAssistantNotifiedRef = useRef<Record<string, number>>({})

  // Track recently-deleted chat keys so we don't resurrect via late updates.
  const deletedKeysRef = useRef<Set<string>>(new Set())

  const updateChatState = (
    key: string,
    patch: Partial<ChatState> | ((prev: ChatState) => ChatState),
  ) => {
    setChats((prev) => {
      const existing = prev[key]
      if (!existing) return prev
      const next =
        typeof patch === 'function' ? patch(existing) : ({ ...existing, ...patch } as ChatState)
      return { ...prev, [key]: next }
    })
  }

  const upsertChatState = (key: string, next: ChatState) => {
    setChats((prev) => ({ ...prev, [key]: next }))
  }

  // --- settings ---
  useEffect(() => {
    let mounted = true
    chatsService
      .getChatSettings()
      .then((s) => {
        if (mounted) setAllChatSettings(s || undefined)
      })
      .catch((e) => {
        console.error('Failed to load chat settings', e)
      })
    return () => {
      mounted = false
    }
  }, [])

  const getSettings = useMemo(
    () => (context: ChatContext) => extractSettingsForContext(allChatSettings, context),
    [allChatSettings],
  )

  // --- chat lifecycle ---
  const getChatIfExists = async (context: ChatContext): Promise<ChatState | undefined> => {
    const key = getChatContextKey(context)
    console.log('getChatIfExists key: ', key)

    if (deletedKeysRef.current.has(key)) return undefined

    const existing = chats[key]
    if (existing) return existing

    try {
      // Old behavior: chatsService.getChat throws if missing.
      const chat = await chatsService.getChat(context)
      const st: ChatState = { key, chat, isLoading: false, isThinking: false }
      upsertChatState(key, st)
      return st
    } catch {
      return undefined
    }
  }

  const getChat = async (context: ChatContext): Promise<ChatState> => {
    const existing = await getChatIfExists(context)
    console.log('getChat context: ', context, ' existing: ', existing)
    if (existing) return existing
    throw new Error('Chat does not exist')
  }

  const restartChat = async (context: ChatContext): Promise<ChatState> => {
    const key = getChatContextKey(context)
    deletedKeysRef.current.delete(key)

    const now = new Date().toISOString()
    const optimistic: ChatState = {
      key,
      chat: { context, messages: [], createdAt: now, updatedAt: now } as any,
      isLoading: false,
      isThinking: false,
    }
    upsertChatState(key, optimistic)

    let chat = await chatsService.clearChat(context)
    if (!chat) chat = await chatsService.getChat(context)

    const st: ChatState = { key, chat: chat!, isLoading: false, isThinking: false }
    upsertChatState(key, st)
    return st
  }

  const deleteChat = async (context: ChatContext): Promise<void> => {
    const key = getChatContextKey(context)
    deletedKeysRef.current.add(key)
    await chatsService.deleteChat(context)
    setChats((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    try {
      clearDraft(key)
    } catch {
      // ignore
    }
  }

  const deleteLastMessage = async (context: ChatContext): Promise<void> => {
    const key = getChatContextKey(context)
    const updated = await chatsService.deleteLastMessage(context)
    if (updated) {
      updateChatState(key, (prev) => ({ ...prev, chat: updated }))
    }
  }

  // --- actions ---
  const abortMessage = async (context: ChatContext) => {
    await completionService.abortCompletion(context)
  }

  const sendMessage: ChatsContextValue['sendMessage'] = async (
    context,
    message,
    prompt,
    settings,
    config,
    files,
  ) => {
    const key = getChatContextKey(context)
    const chatState = await getChat(context)
    if (chatState.isThinking) return

    const now = new Date().toISOString()
    const userMessage = {
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
      chat: { ...chatState.chat, messages: chatMessages } as any,
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
        config as LLMConfig,
      )
    } finally {
      updateChatState(key, { isThinking: false })
    }
  }

  const resumeTools: ChatsContextValue['resumeTools'] = async (
    context,
    toolsGranted,
    prompt,
    settings,
    config,
  ) => {
    const chatProjectId = context.projectId ?? projectId
    await completionService.resumeCompletionTools(
      chatProjectId,
      context,
      toolsGranted,
      prompt,
      settings.completionSettings,
      config as LLMConfig,
    )
  }

  const retryCompletion: ChatsContextValue['retryCompletion'] = async (
    context,
    prompt,
    settings,
    config,
  ) => {
    const chatProjectId = context.projectId ?? projectId
    await completionService.retryCompletionTools(
      chatProjectId,
      context,
      prompt,
      settings.completionSettings,
      config as LLMConfig,
    )
  }

  // --- prompts ---
  const getDefaultPrompt = async (chatContext: ChatContext): Promise<string> => {
    return chatsService.getDefaultPrompt(chatContext)
  }

  const getSettingsPrompt = async (contextArguments: ChatContextArguments): Promise<string> => {
    return chatsService.getSettingsPrompt(contextArguments)
  }

  const updateSettingsPrompt = async (
    context: ChatContext,
    prompt: string,
  ): Promise<string | undefined> => {
    const updated = await chatsService.updateSettingsPrompt(context, prompt)
    setAllChatSettings(updated)
    return extractSettingsForContext(updated, context)?.systemPrompt
  }

  const resetSettingsPrompt = async (context: ChatContext): Promise<string | undefined> => {
    const updated = await chatsService.resetSettingsPrompt(context)
    setAllChatSettings(updated)
    return extractSettingsForContext(updated, context)?.systemPrompt
  }

  // --- completion settings ---
  const updateCompletionSettings = async (
    context: ChatContext,
    patch: Partial<CompletionSettings>,
  ): Promise<ChatSettings | undefined> => {
    const updated = await chatsService.updateChatCompletionSettings(context, patch)
    setAllChatSettings(updated)
    return extractSettingsForContext(updated, context)
  }

  const resetSettings = async (context: ChatContext): Promise<ChatSettings | undefined> => {
    const updated = await chatsService.resetChatSettings(context)
    setAllChatSettings(updated)
    return extractSettingsForContext(updated, context)
  }

  // --- subscription (side-effects) ---
  useEffect(() => {
    const unsub = chatsService.subscribe((update) => {
      const key = getChatContextKey(update.context)

      if (update.type === 'delete') {
        deletedKeysRef.current.add(key)
        setChats((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
        return
      }

      if (!update.chat) return
      if (deletedKeysRef.current.has(key)) return

      setChats((prev) => {
        const existing = prev[key]
        const next: ChatState = {
          ...(existing || { key, isLoading: false, isThinking: false, chat: update.chat! }),
          chat: update.chat!,
        }
        return { ...prev, [key]: next }
      })

      // Notifications: derive a title (chats typically don't have a title)
      try {
        const messages = update.chat.messages || []
        let lastAssistantIdx = -1
        for (let i = messages.length - 1; i >= 0; i--) {
          if ((messages[i] as any)?.role === 'assistant') {
            lastAssistantIdx = i
            break
          }
        }
        const prevIdx = lastAssistantNotifiedRef.current[key] ?? -1
        if (lastAssistantIdx >= 0 && lastAssistantIdx > prevIdx) {
          lastAssistantNotifiedRef.current[key] = lastAssistantIdx
          const last = messages[lastAssistantIdx] as any

          const ctx = update.context
          let title = 'Chat update'
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

          const message = String(last?.content || '')
            .replace(/\s+/g, ' ')
            .slice(0, 120)
          const resolvedPid = update.chat?.context?.projectId || ctx.projectId || projectId

          if (resolvedPid) {
            void notificationsService
              .create(resolvedPid, {
                type: 'info',
                category: 'chat_messages',
                title,
                message: message || 'Assistant responded',
                metadata: { chatKey: key, actionUrl: `#chats${key}` },
              })
              .catch(() => {})
          }
        }
      } catch (e) {
        console.error('notificationsService.create:', e)
      }
    })

    return () => unsub()
  }, [projectId])

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

      // Intentionally included for parity with legacy module.
      activeProjectId: projectId,
      projectsService,
    }),
    [
      chats,
      chatsByProjectId,
      getDraft,
      setDraft,
      clearDraft,
      allChatSettings,
      getSettings,
      projectId,
    ],
  )

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
}
