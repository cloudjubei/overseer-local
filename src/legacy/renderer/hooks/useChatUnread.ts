import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  computeUnreadCounts,
  computeUnreadKeys,
  unreadCountForChat,
} from 'thefactory-ui/headless'
import { useChats } from '@renderer/contexts/chats/ChatsContext'
import type { ChatContext } from 'thefactory-tools'
import { getChatContextKey } from 'thefactory-tools/utils'

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
    // `storage` event doesn't fire in the originating document, so we
    // dispatch a same-document custom event for other hook instances.
    window.dispatchEvent(new CustomEvent(EVT_KEY, { detail: { chatKey, iso } }))
  } catch {}
}

export type UseChatUnread = {
  unreadKeys: Set<string>
  unreadCountByProject: Map<string, number>
  totalUnreadCountByProject: Map<string, number>
  hasUnreadForProject: (projectId?: string) => boolean
  markReadByKey: (chatKey: string, readTime?: string) => void
  markReadByContext: (ctx: ChatContext, readTime?: string) => void
  getUnreadCountForKey: (chatKey: string) => number
  getLastReadForKey: (chatKey: string) => string | undefined
}

export function useChatUnread(): UseChatUnread {
  const { chatsByProjectId } = useChats()
  const [version, setVersion] = useState(0)

  const unreadKeys = useMemo(
    () => computeUnreadKeys(chatsByProjectId, readLastRead),
    [chatsByProjectId, version],
  )

  const { unreadCountByProject, totalUnreadCountByProject } = useMemo(() => {
    const { unreadChatsByProject, unreadMessagesByProject } = computeUnreadCounts(
      chatsByProjectId,
      readLastRead,
    )
    return {
      unreadCountByProject: unreadChatsByProject,
      totalUnreadCountByProject: unreadMessagesByProject,
    }
  }, [chatsByProjectId, version])

  const getUnreadCountForKey = useCallback(
    (chatKey: string) => unreadCountForChat(chatsByProjectId, chatKey, readLastRead),
    [chatsByProjectId, version],
  )

  const hasUnreadForProject = useCallback(
    (projectId?: string) => (projectId ? (unreadCountByProject.get(projectId) ?? 0) > 0 : false),
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

  const getLastReadForKey = useCallback((chatKey: string) => readLastRead(chatKey), [])

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
