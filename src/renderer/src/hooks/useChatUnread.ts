import { useCallback, useEffect, useMemo, useState } from 'react'
import { useChats } from '@renderer/contexts/ChatsContext'
import type { ChatContext, ChatMessage } from 'thefactory-tools'
import { getChatContextPath } from 'thefactory-tools/utils'

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

function messageTimestamp(msg: ChatMessage): string | undefined {
  // Try to derive an ISO timestamp for the message; prefer completion timestamps if present
  const cm = (msg as any).completionMessage
  if (cm?.completedAt) return cm.completedAt as string
  if (cm?.startedAt) return cm.startedAt as string
  // Fallbacks: some implementations may carry createdAt directly
  const createdAt = (msg as any).createdAt
  if (typeof createdAt === 'string') return createdAt
  return undefined
}

export type UseChatUnread = {
  // Set of chat keys that are currently unread
  unreadKeys: Set<string>
  // Count of unread chats per project id
  unreadCountByProject: Map<string, number>
  hasUnreadForProject: (projectId?: string) => boolean
  markReadByKey: (chatKey: string, readTime?: string) => void
  markReadByContext: (ctx: ChatContext, readTime?: string) => void
  // Count of unread messages for a specific chat key
  getUnreadCountForKey: (chatKey: string) => number
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
          if (!msgs.length) return 0
          if (!lastRead) {
            // Never opened: count messages as unread (best effort)
            return msgs.length
          }
          let count = 0
          for (const m of msgs) {
            const ts = messageTimestamp(m)
            if (!ts) {
              // If no timestamp, assume it might be unread only if chat updatedAt is newer
              continue
            }
            if (ts.localeCompare(lastRead) > 0) count += 1
          }
          // Fallback: if none counted but chat updated suggests newer, mark as 1
          const updatedAt = chat.updatedAt || chat.createdAt || ''
          if (count === 0 && updatedAt && lastRead && updatedAt.localeCompare(lastRead) > 0) {
            return 1
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
        const updatedAt = chat.updatedAt || chat.createdAt || ''
        if (!updatedAt) continue
        const lastRead = readLastRead(key)
        if (!lastRead) {
          const hasAny = (chat.messages || []).length > 0
          if (hasAny) keys.add(key)
          continue
        }
        if (updatedAt.localeCompare(lastRead) > 0) {
          keys.add(key)
        }
      }
    }
    return keys
  }, [chatsByProjectId, version])

  const unreadCountByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const [projectId, arr] of Object.entries(chatsByProjectId)) {
      let n = 0
      for (const c of arr) {
        const updatedAt = c.chat.updatedAt || c.chat.createdAt || ''
        if (!updatedAt) continue
        const lastRead = readLastRead(c.key)
        if (!lastRead) {
          const hasAny = (c.chat.messages || []).length > 0
          if (hasAny) n += 1
          continue
        }
        if (updatedAt.localeCompare(lastRead) > 0) n += 1
      }
      map.set(projectId, n)
    }
    return map
  }, [chatsByProjectId, unreadKeys])

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

  const markReadByContext = useCallback(
    (ctx: ChatContext, readTime?: string) => {
      const key = getChatContextPath(ctx)
      writeLastRead(key, readTime || new Date().toISOString())
      setVersion((v) => v + 1)
    },
    [],
  )

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
    hasUnreadForProject,
    markReadByKey,
    markReadByContext,
    getUnreadCountForKey,
  }
}
