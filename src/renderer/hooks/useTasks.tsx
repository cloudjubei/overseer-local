import { useEffect, useMemo, useState } from 'react'
import type { Feature, Task } from '../../../packages/factory-ts/src/types'
import { useActiveProject } from '../projects/ProjectContext'
import { tasksService } from '../services/tasksService'

export function useTasks() {
  const { projectId } = useActiveProject()
  const [tasks, setTasks] = useState<Task[]>([])

  const update = async () => {
    const tasksData = await tasksService.listTasks(projectId)
    setTasks(tasksData)
  }
  const updateCurrentTasks = (tasksList: Task[]) => {
    setTasks(tasksList)
  }

  useEffect(() => {
    update();
    const unsubscribe = tasksService.subscribe(updateCurrentTasks);
    return () => { unsubscribe(); };
  }, [projectId])

  const getTaskById = (taskId: string) => tasks.find(t => t.id === taskId)

  const sortFeatures = (t: Task) => {
    const fdd = t.featureIdToDisplayIndex || {}
    const copy: Feature[] = [...(t.features || [])]
    copy.sort((a, b) => (fdd[a.id] ?? 0) - (fdd[b.id] ?? 0))
    return copy
  }

  const getFeature = (featureId: string): { task?: Task, feature?: Feature } => {
    for (const t of tasks) {
      const f = (t.features || []).find(x => x.id === featureId)
      if (f) return { task: t, feature: f }
    }
    return {}
  }

  return useMemo(() => ({ tasks, getTaskById, sortFeatures, getFeature }), [tasks])
}
