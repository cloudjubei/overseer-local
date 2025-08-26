import { useEffect, useState } from 'react'
import { tasksService } from '../services/tasksService'

export function useNextTaskId(): number {
  const [nextId, setNextId] = useState<number>(1)
  useEffect(() => {
    let unsub: null | (() => void) = null
    ;(async () => {
      try {
        const idx = await tasksService.getSnapshot()
        const ids = Object.values(idx?.tasksById || {})
          .map((t: any) => t.id)
          .filter((n: any) => Number.isInteger(n))
        const max = ids.length > 0 ? Math.max(...ids) : 0
        setNextId(max + 1 || 1)
      } catch (_) {}
      try {
        unsub = tasksService.onUpdate((i: any) => {
          const ids = Object.values(i?.tasksById || {})
            .map((t: any) => t.id)
            .filter((n: any) => Number.isInteger(n))
          const max = ids.length > 0 ? Math.max(...ids) : 0
          setNextId(max + 1 || 1)
        })
      } catch (_) {}
    })()
    return () => {
      try {
        unsub && unsub()
      } catch (_) {}
    }
  }, [])
  return nextId
}
