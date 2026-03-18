import { useCallback, useEffect, useMemo, useState } from 'react'
// import { useChats } from '@renderer/contexts/ChatsContext'
import { useChats } from '@renderer/contexts/chats/ChatsContext'
import type { ChatContext, CompletionMessage } from 'thefactory-tools'
import { getChatContextKey } from 'thefactory-tools/utils'

// LocalStorage helpers
const LS_PREFIX = 'chat:last-read:'
const EVT_KEY = 'chat-last-read-changed'

function lsKeyForChatKey(chatKey: string) {
  return `${LS_PREFIX}${chatKey}`
}
function readLastRead(chatKey: string): string | undefined {
  try {
    return localStorage.getItem(lsKeyForChatKey(chatKey)) || undefined
  } catch {
    return undefined
  }
}
function writeLastRead(chatKey: string, iso: string) {
  try {
    localStorage.setItem(lsKeyForChatKey(chatKey), iso)
    // Broadcast to all hook instances in this document (storage event does not fire in same doc)
    const ev = new CustomEvent(EVT_KEY, { detail: { chatKey, iso } })
    window.dispatchEvent(ev)
  } catch {}
}

function messageTimestamp(msg: CompletionMessage): string | undefined {
  // Try to derive an ISO timestamp for the message; prefer completion timestamps if present
  if ((msg as any)?.completedAt) return (msg as any).completedAt as string
  if ((msg as any)?.startedAt) return (msg as any).startedAt as string
  // Fallbacks: some implementations may carry createdAt directly
  const createdAt = (msg as any).createdAt
  if (typeof createdAt === 'string') return createdAt
  return undefined
}

// Only assistant messages should count as unread
function isAssistant(msg: CompletionMessage): boolean {
  return (msg as any)?.role === 'assistant'
}
function assistantTimestamp(msg: CompletionMessage): string | undefined {
  if (!isAssistant(msg)) return undefined
  return messageTimestamp(msg)
}

export type UseChatUnread = {
  // Set of chat keys that are currently unread
  unreadKeys: Set<string>
  // Count of unread chats per project id
  unreadCountByProject: Map<string, number>
  // Count of total unread messages per project id
  totalUnreadCountByProject: Map<string, number>
  hasUnreadForProject: (projectId?: string) => boolean
  markReadByKey: (chatKey: string, readTime?: string) => void
  markReadByContext: (ctx: ChatContext, readTime?: string) => void
  // Count of unread messages for a specific chat key (assistant messages only)
  getUnreadCountForKey: (chatKey: string) => number
  // Last-read ISO timestamp for a specific chat key (if any)
  getLastReadForKey: (chatKey: string) => string | undefined
}

export function useChatUnread(): UseChatUnread {
  const { chatsByProjectId } = useChats()
  const [version, setVersion] = useState(0) // bump to recompute after marking read

  const getUnreadCountForKey = useCallback(
    (chatKey: string): number => {
      // Find the chat by key
      for (const arr of Object.values(chatsByProjectId)) {
        for (const c of arr) {
          if (c.key !== chatKey) continue
          const chat = c.chat
          const lastRead = readLastRead(chatKey)
          const msgs = chat.messages || []
          const assistantMsgs = msgs.filter(isAssistant)
          if (assistantMsgs.length === 0) return 0
          if (!lastRead) {
            // Never opened: count assistant messages as unread (best effort)
            return assistantMsgs.length
          }
          let count = 0
          for (const m of assistantMsgs) {
            const ts = assistantTimestamp(m)
            if (ts && ts.localeCompare(lastRead) > 0) count += 1
          }
          return count
        }
      }
      return 0
    },
    [chatsByProjectId, version],
  )

  const unreadKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const arr of Object.values(chatsByProjectId)) {
      for (const c of arr) {
        const key = c.key
        const chat = c.chat
        const msgs = chat.messages || []
        // Find last assistant message iso (if any)
        let lastAssistantIso: string | undefined
        for (let i = msgs.length - 1; i >= 0; i--) {
          const ts = assistantTimestamp(msgs[i])
          if (ts) {
            lastAssistantIso = ts
            break
          }
        }
        if (!lastAssistantIso) continue
        const lastRead = readLastRead(key)
        if (!lastRead) {
          keys.add(key)
          continue
        }
        if (lastAssistantIso.localeCompare(lastRead) > 0) {
          keys.add(key)
        }
      }
    }
    return keys
  }, [chatsByProjectId, version])

  const { unreadCountByProject, totalUnreadCountByProject } = useMemo(() => {
    const unreadChats = new Map<string, number>()
    const totalUnread = new Map<string, number>()
    
    for (const [projectId, arr] of Object.entries(chatsByProjectId)) {
      let chatsCount = 0
      let msgsCount = 0
      for (const c of arr) {
        const msgs = c.chat.messages || []
        const assistantMsgs = msgs.filter(isAssistant)
        if (assistantMsgs.length === 0) continue

        const lastRead = readLastRead(c.key)
        if (!lastRead) {
          chatsCount += 1
          msgsCount += assistantMsgs.length
          continue
        }

        let unreadInChat = 0
        for (const m of assistantMsgs) {
          const ts = assistantTimestamp(m)
          if (ts && ts.localeCompare(lastRead) > 0) {
            unreadInChat += 1
          }
        }
        
        if (unreadInChat > 0) {
          chatsCount += 1
          msgsCount += unreadInChat
        }
      }
      unreadChats.set(projectId, chatsCount)
      totalUnread.set(projectId, msgsCount)
    }
    return { unreadCountByProject: unreadChats, totalUnreadCountByProject: totalUnread }
  }, [chatsByProjectId, version])

  const hasUnreadForProject = useCallback(
    (projectId?: string) => {
      if (!projectId) return false
      return (unreadCountByProject.get(projectId) || 0) > 0
    },
    [unreadCountByProject],
  )

  const markReadByKey = useCallback((chatKey: string, readTime?: string) => {
    writeLastRead(chatKey, readTime || new Date().toISOString())
    setVersion((v) => v + 1)
  }, [])

  const markReadByContext = useCallback((ctx: ChatContext, readTime?: string) => {
    const key = getChatContextKey(ctx)
    writeLastRead(key, readTime || new Date().toISOString())
    setVersion((v) => v + 1)
  }, [])

  const getLastReadForKey = useCallback((chatKey: string): string | undefined => {
    return readLastRead(chatKey)
  }, [])

  // React to changes from other tabs/windows and from same-document updates
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith(LS_PREFIX)) setVersion((v) => v + 1)
    }
    const onLocal = () => setVersion((v) => v + 1)
    window.addEventListener('storage', onStorage)
    window.addEventListener(EVT_KEY, onLocal as EventListener)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(EVT_KEY, onLocal as EventListener)
    }
  }, [])

  return {
    unreadKeys,
    unreadCountByProject,
    totalUnreadCountByProject,
    hasUnreadForProject,
    markReadByKey,
    markReadByContext,
    getUnreadCountForKey,
    getLastReadForKey,
  }
}
