import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChatContext,
  ChatUpdate,
  CompletionMessage,
  LLMConfig,
  ChatSettings,
} from 'thefactory-tools'
import { getChatContextKey } from 'thefactory-tools/utils'

import { chatsService } from '@renderer/services/chatsService'
import { projectsService } from '@renderer/services/projectsService'
import { projectsGroupsService } from '@renderer/services/projectsGroupsService'
import { completionService } from '@renderer/services/completionService'
import { notificationsService } from '@renderer/services/notificationsService'
import { useActiveProject } from '@renderer/contexts/ProjectContext'

import type { ChatsContextValue, ChatState } from './ChatsTypes'
import { useChatDrafts } from './ChatsDrafts'
import { useChatSettings } from './ChatsSettings'
import { getNotificationTitleForContext } from './ChatsUtils'
import { ChatsContext } from './ChatsContext'

const DELETED_TOMBSTONE_TTL_MS = 5000

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useActiveProject()
  const { getDraft, setDraft, clearDraft } = useChatDrafts()
  const {
    allChatSettings,
    setAllChatSettings,
    getSettings,
    getDefaultPrompt,
    getSettingsPrompt,
    updateSettingsPrompt,
    resetSettingsPrompt,
    updateCompletionSettings,
    resetSettings,
  } = useChatSettings()

  const [chats, setChats] = useState<Record<string, ChatState>>({})
  const [chatsByProjectId, setChatsByProjectId] = useState<Record<string, ChatState[]>>({})
  const [chatsByGroupId, setChatsByGroupId] = useState<Record<string, ChatState[]>>({})

  // Track last assistant message index we've notified for each chat key.
  const lastAssistantNotifiedRef = useRef<Record<string, number>>({})

  // Track chat->project so we can resolve notifications + last-opened cleanup.
  const chatKeyToProjectIdRef = useRef<Record<string, string>>({})
  const chatKeyToGroupIdRef = useRef<Record<string, string>>({})

  // Track recently-deleted chat keys so we don't resurrect via late updates.
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

  const upsertChatsByGroup = useCallback((chatState: ChatState) => {
    const gid = (chatState.chat.context as any).groupId
    if (!gid) return
    setChatsByGroupId((prev) => {
      const existing = prev[gid] || []
      const idx = existing.findIndex((c) => c.key === chatState.key)
      let nextForGroup: ChatState[]
      if (idx >= 0) {
        nextForGroup = existing.map((c, i) => (i === idx ? { ...c, ...chatState } : c))
      } else {
        nextForGroup = [...existing, chatState]
      }
      return { ...prev, [gid]: nextForGroup }
    })
  }, [])

  const removeFromChatsByGroup = useCallback((chatState: ChatState) => {
    const gid = (chatState.chat.context as any).groupId
    if (!gid) return
    setChatsByGroupId((prev) => {
      const existing = prev[gid] || []
      const nextForGroup = existing.filter((c) => c.key !== chatState.key)
      return { ...prev, [gid]: nextForGroup }
    })
  }, [])

  const updateChatState = useCallback(
    (key: string, updates: Partial<ChatState>) => {
      setChats((prev) => {
        const current = prev[key]
        const base: ChatState =
          current ||
          ({
            key,
            chat: (updates as any).chat,
            isLoading: false,
            isThinking: false,
          } as ChatState)

        const next: ChatState = { ...base, ...updates }
        if (next.chat) {
          upsertChatsByProject(next)
          upsertChatsByGroup(next)
        }
        return { ...prev, [key]: next }
      })
    },
    [upsertChatsByProject, upsertChatsByGroup],
  )

  // --- initial load (legacy parity) ---
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [projects, groups, settings] = await Promise.all([
          projectsService.listProjects(),
          projectsGroupsService.listProjectsGroups(),
          chatsService.getChatSettings(),
        ])

        setAllChatSettings(settings || undefined)

        const byProject: Record<string, ChatState[]> = {}
        const byGroup: Record<string, ChatState[]> = {}
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

              // Seed notification baseline
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

        for (const group of groups) {
          try {
            const groupChats = await chatsService.listChats(group.id)
            const chatStates: ChatState[] = groupChats.map((chat) => ({
              key: getChatContextKey(chat.context),
              chat,
              isLoading: false,
              isThinking: false,
            }))

            byGroup[group.id] = chatStates

            for (const st of chatStates) {
              all[st.key] = st
              chatKeyToGroupIdRef.current[st.key] = group.id

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
            console.error(`Failed to list chats for group ${group.id}`, e)
          }
        }

        setChats(all)
        setChatsByProjectId(byProject)
        setChatsByGroupId(byGroup)
      } catch (e) {
        console.error('Failed to load chats/settings', e)
      }
    }

    void loadAll()
  }, [setAllChatSettings])

  // --- chat lifecycle ---
  const getChatIfExists = useCallback(
    async (context: ChatContext): Promise<ChatState | undefined> => {
      const key = getChatContextKey(context)
      if (isTombstoned(key)) return undefined

      const existing = chats[key]
      if (existing) return existing

      try {
        const chat = await chatsService.getChat(context)
        const chatState: ChatState = { key, chat, isLoading: false, isThinking: false }
        updateChatState(key, chatState)
        try {
          const pid = chat.context?.projectId
          if (pid) chatKeyToProjectIdRef.current[key] = pid
          const gid = (chat.context as any)?.groupId
          if (gid) chatKeyToGroupIdRef.current[key] = gid
        } catch {
          // ignore
        }
        return chatState
      } catch {
        return undefined
      }
    },
    [chats, isTombstoned, updateChatState],
  )

  const getChat = useCallback(
    async (context: ChatContext): Promise<ChatState> => {
      const chatState = await getChatIfExists(context)
      if (!chatState) throw new Error('Chat does not exist')
      return chatState
    },
    [getChatIfExists],
  )

  const restartChat = useCallback(
    async (context: ChatContext): Promise<ChatState> => {
      const key = getChatContextKey(context)
      clearDeleted(key)

      const now = new Date().toISOString()
      const optimistic: ChatState = {
        key,
        chat: { context, messages: [], createdAt: now, updatedAt: now } as any,
        isLoading: false,
        isThinking: false,
      }

      updateChatState(key, optimistic)

      let chat = await chatsService.clearChat(context)
      if (!chat) chat = await chatsService.getChat(context)

      const st: ChatState = { key, chat: chat!, isLoading: false, isThinking: false }
      updateChatState(key, st)
      try {
        const pid = chat?.context?.projectId
        if (pid) chatKeyToProjectIdRef.current[key] = pid
        const gid = (chat?.context as any)?.groupId
        if (gid) chatKeyToGroupIdRef.current[key] = gid
      } catch {
        // ignore
      }
      return st
    },
    [clearDeleted, updateChatState],
  )

  const deleteChat = useCallback(
    async (context: ChatContext): Promise<void> => {
      const key = getChatContextKey(context)
      markDeleted(key)

      setChats((prev) => {
        const next = { ...prev }
        const existing = next[key]
        if (existing) {
          removeFromChatsByProject(existing)
          removeFromChatsByGroup(existing)
        }
        delete next[key]
        return next
      })

      try {
        clearDraft(key)
      } catch {
        // ignore
      }

      try {
        delete chatKeyToProjectIdRef.current[key]
        delete chatKeyToGroupIdRef.current[key]
      } catch {
        // ignore
      }

      await chatsService.deleteChat(context)
    },
    [markDeleted, removeFromChatsByProject, removeFromChatsByGroup, clearDraft],
  )

  const deleteLastMessage = useCallback(
    async (context: ChatContext): Promise<void> => {
      const key = getChatContextKey(context)
      const chatState = await getChat(context)
      if (chatState.isThinking) return

      try {
        const updated = await chatsService.deleteLastMessage(context)
        if (updated) {
          updateChatState(key, { chat: updated })
        }
      } catch (e) {
        console.error('Failed to delete last message', e)
      }
    },
    [getChat, updateChatState],
  )

  // --- actions ---
  const abortMessage = useCallback(async (context: ChatContext) => {
    try {
      await completionService.abortCompletion(context)
    } catch (e) {
      console.warn('Abort failed or not available for chat', e)
    }
  }, [])

  const sendMessage = useCallback(
    async (
      context: ChatContext,
      message: string,
      prompt: string,
      settings: ChatSettings,
      config: LLMConfig,
      files?: string[],
    ) => {
      const key = getChatContextKey(context)
      const chatState = await getChat(context)
      if (chatState.isThinking) return

      const now = new Date().toISOString()
      const userMessage: CompletionMessage = {
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
      } catch (e) {
        console.error('completionService.sendCompletionTools:', e)
      } finally {
        updateChatState(key, { isThinking: false })
      }
    },
    [projectId, getChat, updateChatState],
  )

  const resumeTools = useCallback(
    async (
      context: ChatContext,
      toolsGranted: string[],
      prompt: string,
      settings: ChatSettings,
      config: LLMConfig,
    ) => {
      const key = getChatContextKey(context)
      const chatState = await getChat(context)
      if (chatState.isThinking) return

      updateChatState(key, { ...chatState, isThinking: true })

      const chatProjectId = context.projectId ?? projectId
      try {
        await completionService.resumeCompletionTools(
          chatProjectId,
          context,
          toolsGranted,
          prompt,
          settings.completionSettings,
          config as LLMConfig,
        )
      } catch (e) {
        console.error('completionService.resumeCompletionTools:', e)
      } finally {
        updateChatState(key, { isThinking: false })
      }
    },
    [projectId, getChat, updateChatState],
  )

  const retryCompletion = useCallback(
    async (context: ChatContext, prompt: string, settings: ChatSettings, config: LLMConfig) => {
      const key = getChatContextKey(context)
      const chatState = await getChat(context)
      if (chatState.isThinking) return

      updateChatState(key, { ...chatState, isThinking: true })

      const chatProjectId = context.projectId ?? projectId
      try {
        await completionService.retryCompletionTools(
          chatProjectId,
          context,
          prompt,
          settings.completionSettings,
          config as LLMConfig,
        )
      } catch (e) {
        console.error('completionService.retryCompletionTools:', e)
      } finally {
        updateChatState(key, { isThinking: false })
      }
    },
    [projectId, getChat, updateChatState],
  )

  // --- subscription (legacy parity) ---
  useEffect(() => {
    const unsubscribe = chatsService.subscribe((chatUpdate: ChatUpdate) => {
      const key = getChatContextKey(chatUpdate.context)

      setChats((prev) => {
        const newChats = { ...prev }

        if (chatUpdate.type === 'delete') {
          const existing = newChats[key]
          if (existing) {
            removeFromChatsByProject(existing)
            removeFromChatsByGroup(existing)
          }

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
            delete chatKeyToGroupIdRef.current[key]
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
          upsertChatsByGroup(next)

          try {
            const pidFromChat = chatUpdate.chat?.context?.projectId
            const pidFromCtx = chatUpdate.context.projectId
            const pid = pidFromChat || pidFromCtx
            if (pid) chatKeyToProjectIdRef.current[key] = pid

            const gidFromChat = (chatUpdate.chat?.context as any)?.groupId
            const gidFromCtx = (chatUpdate.context as any)?.groupId
            const gid = gidFromChat || gidFromCtx
            if (gid) chatKeyToGroupIdRef.current[key] = gid
          } catch {
            // ignore
          }

          // Notify on new assistant messages
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

                const title = getNotificationTitleForContext(chatUpdate.context)

                const raw = String((msgs[lastAssistantIdx] as any)?.content || '')
                const snippet = raw.replace(/\s+/g, ' ').slice(0, 120)
                const message = snippet || 'Assistant responded'

                const actionUrl = `#chats${getChatContextKey(chatUpdate.context)}`

                const resolvedPid =
                  chatKeyToProjectIdRef.current[key] ||
                  chatUpdate.chat?.context?.projectId ||
                  chatUpdate.context.projectId ||
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
  }, [
    clearDraft,
    isTombstoned,
    markDeleted,
    projectId,
    removeFromChatsByProject,
    removeFromChatsByGroup,
    removeLastOpenedChatKey,
    upsertChatsByProject,
    upsertChatsByGroup,
  ])

  const value = useMemo<ChatsContextValue>(
    () => ({
      chats,
      chatsByProjectId,
      chatsByGroupId,

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
      chatsByGroupId,
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
    ],
  )

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
}
