import { useMemo } from 'react'
import type { Task } from '../../../packages/factory-ts/src/types'

export function useNextTaskId(tasks: Task[]) {
  return useMemo(() => {
    let next = 1
    const existing = new Set(tasks.map(t => Number(t.id)).filter(n => !Number.isNaN(n)))
    while (existing.has(next)) next++
    return String(next)
  }, [tasks])
}
