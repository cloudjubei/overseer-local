import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const DELETED_TOMBSTONE_TTL_MS = 5000

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useActiveProject()
  const { getDraft, setDraft, clearDraft } = useChatDrafts()

  const [chats, setChats] = useState<Record<string, ChatState>>({})
  const [chatsByProjectId, setChatsByProjectId] = useState<Record<string, ChatState[]>>({})
  const [allChatSettings, setAllChatSettings] = useState<ChatsSettings | undefined>(undefined)

  // Track last assistant message index we've notified for each chat key.
  const lastAssistantNotifiedRef = useRef<Record<string, number>>({})

  // Track chat->project so we can resolve notifications + last-opened cleanup.
  const chatKeyToProjectIdRef = useRef<Record<string, string>>({})

  // Track recently-deleted chat keys so we don't resurrect via late updates.
  // IMPORTANT: this must be a short-lived tombstone (NOT permanent), otherwise the user
  // cannot delete a chat and later create a new one for the same context without restarting.
  const deletedAtByKeyRef = useRef<Map<string, number>>(new Map())

  const isTombstoned = useCallback((chatKey: string): boolean => {
    const deletedAt = deletedAtByKeyRef.current.get(chatKey)
    if (!deletedAt) return false
    const age = Date.now() - deletedAt
    if (age > DELETED_TOMBSTONE_TTL_MS) {
      deletedAtByKeyRef.current.delete(chatKey)
      return false
    }
    return true
  }, [])

  const markDeleted = useCallback((chatKey: string) => {
    deletedAtByKeyRef.current.set(chatKey, Date.now())
  }, [])

  const clearDeleted = useCallback((chatKey: string) => {
    deletedAtByKeyRef.current.delete(chatKey)
  }, [])

  const removeLastOpenedChatKey = useCallback((pid: string, chatKey: string) => {
    try {
      const storageKey = `chat-last-opened:${pid}`
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const map = JSON.parse(raw) as Record<string, number>
      if (!map || typeof map !== 'object') return
      if (!(chatKey in map)) return
      delete map[chatKey]
      localStorage.setItem(storageKey, JSON.stringify(map))
    } catch {
      // ignore invalid/missing localStorage
    }
  }, [])

  const upsertChatsByProject = useCallback((chatState: ChatState) => {
    const pid = chatState.chat.context.projectId
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
    const pid = chatState.chat.context.projectId
    if (!pid) return
    setChatsByProjectId((prev) => {
      const existing = prev[pid] || []
      const nextForProject = existing.filter((c) => c.key !== chatState.key)
      return { ...prev, [pid]: nextForProject }
    })
  }, [])

  // --- settings + initial load (legacy parity) ---
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [projects, settings] = await Promise.all([
          projectsService.listProjects(),
          chatsService.getChatSettings(),
        ])

        setAllChatSettings(settings || undefined)

        const byProject: Record<string, ChatState[]> = {}
        const all: Record<string, ChatState> = {}

        for (const project of projects) {
          try {
            const projectChats = await chatsService.listChats(project.id)
            const chatStates: ChatState[] = projectChats.map((chat) => ({
              key: getChatContextKey(chat.context),
              chat,
              isLoading: false,
              isThinking: false,
            }))

            byProject[project.id] = chatStates

            for (const st of chatStates) {
              all[st.key] = st
              chatKeyToProjectIdRef.current[st.key] = project.id

              // Seed notification baseline to avoid firing notifications on boot.
              try {
                const msgs = st.chat?.messages || []
                let lastAssistantIdx = -1
                for (let i = msgs.length - 1; i >= 0; i--) {
                  if ((msgs[i] as any)?.role === 'assistant') {
                    lastAssistantIdx = i
                    break
                  }
                }
                lastAssistantNotifiedRef.current[st.key] = lastAssistantIdx
              } catch {
                // ignore
              }
            }
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

    void loadAll()
  }, [])

  const getSettings = useMemo(
    () => (context: ChatContext) => extractSettingsForContext(allChatSettings, context),
    [allChatSettings],
  )

  // --- chat lifecycle ---
  const getChatIfExists = async (context: ChatContext): Promise<ChatState | undefined> => {
    const key = getChatContextKey(context)
    if (isTombstoned(key)) return undefined

    const existing = chats[key]
    if (existing) return existing

    try {
      // Old behavior: chatsService.getChat throws if missing.
      const chat = await chatsService.getChat(context)
      const st: ChatState = { key, chat, isLoading: false, isThinking: false }
      setChats((prev) => ({ ...prev, [key]: st }))
      upsertChatsByProject(st)
      return st
    } catch {
      return undefined
    }
  }

  const getChat = async (context: ChatContext): Promise<ChatState> => {
    const existing = await getChatIfExists(context)
    if (existing) return existing
    throw new Error('Chat does not exist')
  }

  const restartChat = async (context: ChatContext): Promise<ChatState> => {
    const key = getChatContextKey(context)
    clearDeleted(key)

    const now = new Date().toISOString()
    const optimistic: ChatState = {
      key,
      chat: { context, messages: [], createdAt: now, updatedAt: now } as any,
      isLoading: false,
      isThinking: false,
    }

    setChats((prev) => ({ ...prev, [key]: optimistic }))
    upsertChatsByProject(optimistic)

    let chat = await chatsService.clearChat(context)
    if (!chat) chat = await chatsService.getChat(context)

    const st: ChatState = { key, chat: chat!, isLoading: false, isThinking: false }
    setChats((prev) => ({ ...prev, [key]: st }))
    upsertChatsByProject(st)
    return st
  }

  const deleteChat = async (context: ChatContext): Promise<void> => {
    const key = getChatContextKey(context)
    markDeleted(key)

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
    if (!updated) return

    setChats((prev) => {
      const existing = prev[key]
      if (!existing) return prev
      const next: ChatState = { ...existing, chat: updated }
      return { ...prev, [key]: next }
    })
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

    setChats((prev) => {
      const existing = prev[key]
      if (!existing) return prev
      const next: ChatState = {
        ...existing,
        chat: { ...existing.chat, messages: chatMessages } as any,
        isThinking: true,
      }
      return { ...prev, [key]: next }
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
      setChats((prev) => {
        const existing = prev[key]
        if (!existing) return prev
        return { ...prev, [key]: { ...existing, isThinking: false } }
      })
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

  const retryCompletion: ChatsContextValue['retryCompletion'] = async (context, prompt, settings, config) => {
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

  // --- subscription (legacy parity) ---
  useEffect(() => {
    const unsubscribe = chatsService.subscribe((chatUpdate) => {
      const key = getChatContextKey(chatUpdate.context)

      setChats((prev) => {
        const newChats = { ...prev }

        if (chatUpdate.type === 'delete') {
          const existing = newChats[key]
          if (existing) removeFromChatsByProject(existing)

          // Short-lived tombstone to prevent immediate late-update resurrection.
          markDeleted(key)

          try {
            const pid =
              (existing?.chat?.context as any)?.projectId ||
              (chatUpdate.context as any)?.projectId ||
              projectId
            if (pid) removeLastOpenedChatKey(pid, key)
          } catch {
            // ignore
          }

          delete newChats[key]
          try {
            delete chatKeyToProjectIdRef.current[key]
          } catch {
            // ignore
          }

          try {
            const pid =
              (existing?.chat?.context as any)?.projectId ||
              (chatUpdate.context as any)?.projectId ||
              projectId
            if (pid) {
              void (async () => {
                try {
                  const recent = await notificationsService.getRecentNotifications(pid)
                  const targets = (recent || []).filter((n: any) => {
                    if (n.read) return false
                    if (n.category !== 'chat_messages') return false
                    const md = (n.metadata || {}) as any
                    return md.chatKey === key
                  })
                  for (const n of targets) {
                    try {
                      await notificationsService.markNotificationAsRead(pid, n.id)
                    } catch {
                      // ignore
                    }
                  }
                } catch {
                  // ignore
                }
              })()
            }
          } catch {
            // ignore
          }

          try {
            clearDraft(key)
          } catch {
            // ignore
          }

          return newChats
        }

        if (chatUpdate.type === 'change') {
          // If this key was deleted very recently, ignore late updates.
          if (isTombstoned(key)) {
            return newChats
          }

          const next: ChatState = {
            ...(newChats[key] || {
              key,
              isLoading: false,
              isThinking: false,
              chat: chatUpdate.chat!,
            }),
            chat: chatUpdate.chat!,
          }

          newChats[key] = next
          upsertChatsByProject(next)

          try {
            const pidFromChat = chatUpdate.chat?.context?.projectId
            const pidFromCtx = chatUpdate.context.projectId
            const pid = pidFromChat || pidFromCtx
            if (pid) chatKeyToProjectIdRef.current[key] = pid
          } catch {
            // ignore
          }

          // Notify on new assistant messages (legacy baseline logic)
          try {
            const msgs = chatUpdate.chat?.messages || []
            let lastAssistantIdx = -1
            for (let i = msgs.length - 1; i >= 0; i--) {
              const role = (msgs[i] as any)?.role
              if (role === 'assistant') {
                lastAssistantIdx = i
                break
              }
            }

            if (lastAssistantIdx >= 0) {
              const prevChat = prev[key]?.chat
              let prevAssistantIdx = -1
              if (prevChat) {
                const prevMsgs = prevChat.messages || []
                for (let i = prevMsgs.length - 1; i >= 0; i--) {
                  const role = (prevMsgs[i] as any)?.role
                  if (role === 'assistant') {
                    prevAssistantIdx = i
                    break
                  }
                }
              }

              const seenIdx = lastAssistantNotifiedRef.current[key] ?? -1
              const baseline = Math.max(prevAssistantIdx, seenIdx)
              const isLatestAssistant = (msgs[lastAssistantIdx] as any)?.role === 'assistant'

              if (isLatestAssistant && lastAssistantIdx > baseline) {
                lastAssistantNotifiedRef.current[key] = lastAssistantIdx

                const ctx = chatUpdate.context
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

                const raw = String((msgs[lastAssistantIdx] as any)?.content || '')
                const snippet = raw.replace(/\s+/g, ' ').slice(0, 120)
                const message = snippet || 'Assistant responded'

                const actionUrl = `#chats${getChatContextKey(ctx)}`

                const resolvedPid =
                  chatKeyToProjectIdRef.current[key] ||
                  chatUpdate.chat?.context?.projectId ||
                  ctx.projectId ||
                  projectId

                if (resolvedPid) {
                  void notificationsService
                    .create(resolvedPid, {
                      type: 'info',
                      category: 'chat_messages',
                      title,
                      message,
                      metadata: { chatKey: key, actionUrl },
                    })
                    .catch(() => {})
                }
              }
            }
          } catch (e) {
            console.error('notificationsService.create:', e)
          }

          return newChats
        }

        return newChats
      })
    })

    return () => unsubscribe()
  }, [clearDraft, isTombstoned, markDeleted, projectId, removeFromChatsByProject, removeLastOpenedChatKey, upsertChatsByProject])

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
    }),
    [
      chats,
      chatsByProjectId,
      getDraft,
      setDraft,
      clearDraft,
      allChatSettings,
      getSettings,
    ],
  )

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
}
