import { useEffect, useState } from 'react'
import { taskService } from '../services/taskService'
import type { Task } from 'src/types/tasks'
import type { TasksIndexSnapshot } from '../../types/external'

export function useNextTaskId(): number {
  const [nextId, setNextId] = useState<number>(1)
  useEffect(() => {
    let unsub: null | (() => void) = null
    ;(async () => {
      try {
        const idx: TasksIndexSnapshot = await taskService.getSnapshot()
        const ids = Object.values(idx?.tasksById || {})
          .map((t: Task) => t.id)
          .filter((n: number) => Number.isInteger(n))
        const max = ids.length > 0 ? Math.max(...ids) : 0
        setNextId((max || 0) + 1)
      } catch (_) {}
      try {
        unsub = taskService.onUpdate((i: TasksIndexSnapshot) => {
          const ids = Object.values(i?.tasksById || {})
            .map((t: Task) => t.id)
            .filter((n: number) => Number.isInteger(n))
          const max = ids.length > 0 ? Math.max(...ids) : 0
          setNextId((max || 0) + 1)
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
