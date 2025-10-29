import { useCallback, useEffect, useMemo, useState } from 'react'
import { useChats } from '@renderer/contexts/ChatsContext'
import type { ChatContext } from 'thefactory-tools'
import { getChatContextPath } from 'thefactory-tools/utils'

// LocalStorage helpers
const LS_PREFIX = 'chat:last-read:'
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
  } catch {}
}

export type UseChatUnread = {
  // Set of chat keys that are currently unread
  unreadKeys: Set<string>
  // Count of unread chats per project id
  unreadCountByProject: Map<string, number>
  hasUnreadForProject: (projectId?: string) => boolean
  markReadByKey: (chatKey: string, readTime?: string) => void
  markReadByContext: (ctx: ChatContext, readTime?: string) => void
}

export function useChatUnread(): UseChatUnread {
  const { chatsByProjectId } = useChats()
  const [version, setVersion] = useState(0) // bump to recompute after marking read

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
          // Never opened => consider unread if there is at least one non-system message
          // If there are messages, we mark as unread; if empty, skip
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

  // Ensure we react to storage changes from other tabs/windows (just in case)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith(LS_PREFIX)) setVersion((v) => v + 1)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { unreadKeys, unreadCountByProject, hasUnreadForProject, markReadByKey, markReadByContext }
}
