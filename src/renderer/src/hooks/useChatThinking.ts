import { useMemo } from 'react'
import {
  aggregateThinkingByProject,
  computeChatKeyToProjectId,
  computeThinkingKeys,
  useDebouncedSetExit,
} from 'thefactory-ui/headless'
import { useChats } from '@renderer/contexts/chats/ChatsContext'

export type UseChatThinking = {
  thinkingKeys: ReadonlySet<string>
  thinkingCountByProject: Map<string, number>
  isThinkingKey: (key?: string) => boolean
  anyThinkingForProject: (projectId?: string) => boolean
}

/**
 * Debounced display of chat streaming state. A key briefly leaving the live
 * set doesn't drop the spinner — it lingers for `debounceMs` so back-to-back
 * runs render without flicker.
 */
export function useChatThinking(debounceMs: number = 500): UseChatThinking {
  const { chatsByProjectId } = useChats()

  const liveThinkingKeys = useMemo(() => computeThinkingKeys(chatsByProjectId), [chatsByProjectId])
  const keyToProjectId = useMemo(
    () => computeChatKeyToProjectId(chatsByProjectId),
    [chatsByProjectId],
  )

  const displayKeys = useDebouncedSetExit(liveThinkingKeys, debounceMs)

  const thinkingCountByProject = useMemo(
    () => aggregateThinkingByProject(displayKeys, keyToProjectId),
    [displayKeys, keyToProjectId],
  )

  return {
    thinkingKeys: displayKeys,
    thinkingCountByProject,
    isThinkingKey: (key?: string) => (key ? displayKeys.has(key) : false),
    anyThinkingForProject: (projectId?: string) =>
      projectId ? (thinkingCountByProject.get(projectId) ?? 0) > 0 : false,
  }
}
