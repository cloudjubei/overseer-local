import { useEffect, useMemo, useState } from 'react'
import { ServiceResult } from '../services/serviceResult'
import { LLMConfig } from 'thefactory-tools'
import { Chat, ChatMessage } from 'src/chat/ChatsManager'
import {
  contextChatsService,
  ContextChatData,
  ContextChatIdentifier,
  ContextChatMessage,
  ContextChatSettings,
} from '../services/contextChatsService'

function parseContextId(contextId: string | undefined): ContextChatIdentifier | undefined {
  if (!contextId) return undefined
  // Expecting formats:
  // - projectId
  // - projectId/storyId
  // - projectId/storyId/featureId
  // For scope-based (tests/agents), future-proof by allowing projectId@scope
  const scopeSepIdx = contextId.indexOf('@')
  if (scopeSepIdx > 0) {
    const projectId = contextId.slice(0, scopeSepIdx)
    const scope = contextId.slice(scopeSepIdx + 1) as any
    if (!projectId || !scope) return undefined
    return { projectId, scope }
  }
  const parts = contextId.split('/').filter(Boolean)
  if (parts.length === 1) {
    const [projectId] = parts
    return { projectId }
  }
  if (parts.length === 2) {
    const [projectId, storyId] = parts
    return { projectId, storyId }
  }
  if (parts.length >= 3) {
    const [projectId, storyId, featureId] = parts
    return { projectId, storyId, featureId }
  }
  return undefined
}

export function useContextualChat(contextId?: string) {
  const [data, setData] = useState<ContextChatData | undefined>()
  const [isThinking, setIsThinking] = useState(false)

  // Build a Chat-like object for ChatSidebar consumption
  const currentChat: Chat | undefined = useMemo(() => {
    if (!data) return undefined
    return {
      id: buildSyntheticChatId(data.context),
      messages: (data.messages as unknown as ChatMessage[]) || [],
      creationDate: data.createdAt,
      updateDate: data.updatedAt,
    } as Chat
  }, [data])

  const chatsById = useMemo(() => {
    if (!currentChat) return {}
    return { [currentChat.id]: currentChat }
  }, [currentChat])

  const settings: ContextChatSettings | undefined = data?.settings

  const buildContext = (): ContextChatIdentifier | undefined => parseContextId(contextId)

  const update = async () => {
    const ctx = buildContext()
    if (!ctx) {
      setData(undefined)
      return
    }
    try {
      const d = await contextChatsService.getContextChat(ctx, true)
      setData(d)
    } catch (e) {
      console.error('Failed to load context chat', e)
      setData(undefined)
    }
  }

  useEffect(() => {
    update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId])

  const createChat = async (): Promise<Chat | undefined> => {
    const ctx = buildContext()
    if (!ctx) return undefined
    const d = await contextChatsService.getContextChat(ctx, true)
    setData(d)
    return {
      id: buildSyntheticChatId(ctx),
      messages: (d.messages as unknown as ChatMessage[]) || [],
      creationDate: d.createdAt,
      updateDate: d.updatedAt,
    }
  }

  const deleteChat = async (_chatId: string): Promise<ServiceResult> => {
    const ctx = buildContext()
    if (!ctx) return { ok: false }
    try {
      const res = await contextChatsService.deleteContextChat(ctx)
      if (res.ok) setData(undefined)
      return res
    } catch (e) {
      console.error('Failed to delete context chat', e)
      return { ok: false }
    }
  }

  const sendMessage = async (
    message: string,
    _config: LLMConfig,
    attachments?: string[],
  ): Promise<ServiceResult> => {
    const ctx = buildContext()
    if (!ctx) return { ok: false }

    const userMessage: ContextChatMessage = {
      role: 'user',
      content: message,
      attachments: attachments && attachments.length ? attachments : undefined,
    }

    // Optimistically update local data
    setData((prev) => {
      const now = new Date().toISOString()
      const base: ContextChatData =
        prev ?? { context: ctx, messages: [], createdAt: now, updatedAt: now }
      return {
        ...base,
        messages: [...(base.messages || []), userMessage],
        updatedAt: now,
      }
    })

    setIsThinking(true)
    try {
      await contextChatsService.saveContextChat(ctx, {
        messages: [
          ...((data?.messages as ContextChatMessage[]) || []),
          userMessage,
        ],
      })
      return { ok: true }
    } catch (e) {
      console.error('Failed to save context chat message', e)
      return { ok: false }
    } finally {
      setIsThinking(false)
    }
  }

  const setSettings = async (patch: Partial<ContextChatSettings>): Promise<ServiceResult> => {
    const ctx = buildContext()
    if (!ctx) return { ok: false }

    const next: ContextChatSettings = {
      ...(settings || {}),
      ...patch,
    }

    // Optimistic local update
    setData((prev) => {
      const base: ContextChatData =
        prev ?? { context: ctx, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      return {
        ...base,
        settings: next,
        updatedAt: new Date().toISOString(),
      }
    })

    try {
      await contextChatsService.saveContextChat(ctx, { settings: next })
      return { ok: true }
    } catch (e) {
      console.error('Failed to save context chat settings', e)
      return { ok: false }
    }
  }

  return {
    currentChatId: currentChat?.id,
    setCurrentChatId: (_id: string | undefined) => {},
    chatsById,
    createChat,
    deleteChat,
    sendMessage,
    isThinking,
    settings,
    setSettings,
  }
}

function buildSyntheticChatId(ctx: ContextChatIdentifier): string {
  // Stable id based on context for UI; not used for storage
  const { projectId, storyId, featureId, scope } = ctx
  if (scope && !storyId && !featureId) return `${projectId}@${scope}`
  if (projectId && storyId && featureId) return `${projectId}/${storyId}/${featureId}`
  if (projectId && storyId) return `${projectId}/${storyId}`
  return projectId
}
