import { useMemo } from 'react'
import type { Feature, Task } from '../../../packages/factory-ts/src/types'

export function useDependencyResolver(tasks: Task[]) {
  const map = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks])

  const getFeatureDependencies = (taskId: string, featureId: string): Feature[] => {
    const task = map.get(taskId)
    if (!task) return []
    const f = (task.features || []).find(x => x.id === featureId)
    if (!f) return []
    const deps = f.dependencies || []
    const all: Feature[] = []
    for (const depId of deps) {
      const dep = (task.features || []).find(x => x.id === depId)
      if (dep) all.push(dep)
    }
    return all
  }

  return useMemo(() => ({ getFeatureDependencies }), [map])
}
