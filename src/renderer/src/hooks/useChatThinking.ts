import { useEffect, useMemo, useRef, useState } from 'react'
import { useChats } from '@renderer/contexts/ChatsContext'

export type UseChatThinking = {
  thinkingKeys: Set<string>
  thinkingCountByProject: Map<string, number>
  isThinkingKey: (key?: string) => boolean
  anyThinkingForProject: (projectId?: string) => boolean
}

// Debounced display of chat streaming state to avoid flicker when runs end
// Keeps a key in the displayed set ~500ms after it stops thinking
export function useChatThinking(debounceMs: number = 500): UseChatThinking {
  const { chatsByProjectId } = useChats()

  // Current (non-debounced) thinking keys derived from context state
  const liveThinkingKeys = useMemo(() => {
    const set = new Set<string>()
    for (const arr of Object.values(chatsByProjectId)) {
      for (const c of arr) {
        if (c.isThinking) set.add(c.key)
      }
    }
    return set
  }, [chatsByProjectId])

  // Map chat key -> project id for aggregations
  const keyToProjectId = useMemo(() => {
    const map = new Map<string, string>()
    for (const [pid, arr] of Object.entries(chatsByProjectId)) {
      for (const c of arr) map.set(c.key, pid)
    }
    return map
  }, [chatsByProjectId])

  const [displayKeys, setDisplayKeys] = useState<Set<string>>(new Set())
  const timersRef = useRef<Map<string, number>>(new Map())

  // Sync display set with live set, adding immediately and removing after debounce when needed
  useEffect(() => {
    // Add/update all currently thinking keys immediately
    setDisplayKeys((prev) => {
      const next = new Set(prev)
      for (const k of liveThinkingKeys) {
        next.add(k)
        const t = timersRef.current.get(k)
        if (t) {
          window.clearTimeout(t)
          timersRef.current.delete(k)
        }
      }
      return next
    })

    // For keys no longer thinking, schedule removal
    setDisplayKeys((prev) => {
      const next = new Set(prev)
      for (const k of prev) {
        if (!liveThinkingKeys.has(k) && !timersRef.current.get(k)) {
          const timeout = window.setTimeout(() => {
            setDisplayKeys((cur) => {
              const nn = new Set(cur)
              nn.delete(k)
              return nn
            })
            timersRef.current.delete(k)
          }, debounceMs)
          timersRef.current.set(k, timeout)
        }
      }
      return next
    })

    return () => {
      // no-op
    }
  }, [liveThinkingKeys, debounceMs])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) window.clearTimeout(t)
      timersRef.current.clear()
    }
  }, [])

  const thinkingCountByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const k of displayKeys) {
      const pid = keyToProjectId.get(k)
      if (!pid) continue
      map.set(pid, (map.get(pid) || 0) + 1)
    }
    return map
  }, [displayKeys, keyToProjectId])

  const isThinkingKey = (key?: string) => (key ? displayKeys.has(key) : false)
  const anyThinkingForProject = (projectId?: string) => {
    if (!projectId) return false
    return (thinkingCountByProject.get(projectId) || 0) > 0
  }

  return { thinkingKeys: displayKeys, thinkingCountByProject, isThinkingKey, anyThinkingForProject }
}
