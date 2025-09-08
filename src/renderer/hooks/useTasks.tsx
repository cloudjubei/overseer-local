import { useEffect, useMemo, useState } from 'react';
import { InvalidRefError, ResolvedFeatureRef, ResolvedRef, ResolvedTaskRef, TaskCreateInput, tasksService } from '../services/tasksService';
import { projectsService } from '../services/projectsService';
import { useActiveProject } from '../projects/ProjectContext';
import { Feature, ProjectSpec, Task } from 'thefactory-tools';
import { ServiceResult } from '../services/serviceResult';

function isUUID(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
}

export function useTasks() {
  const {
    project
  } = useActiveProject()

  const [tasksById, setTasksById] = useState<Record<string,Task>>({});
  const [featuresById, setFeaturesById] = useState<Record<string,Feature>>({});
  const [blockersOutboundById, setReferencesById] = useState<Record<string,ResolvedRef[]>>({});
  const [taskDisplayToId, setTaskDisplayToId] = useState<Record<string,string>>({});
  const [featureDisplayToIdByTask, setFeatureDisplayToIdByTask] = useState<Record<string, Record<string,string>>>({});

  const update = async () => {
    if (project){
      const tasks = await tasksService.listTasks(project.id)
      updateCurrentProjectTasks(project, tasks)
    }
  }
  const updateCurrentProjectTasks = (project: ProjectSpec, tasks: Task[]) => {
    const newTasksById : Record<string,Task> = {}
    const newFeaturesById : Record<string,Feature> = {}
    const taskDisplayMap: Record<string,string> = {}
    const featureDisplayMapByTask: Record<string, Record<string,string>> = {}
    for(const t of tasks){
      newTasksById[t.id] = t
      const tDisplay = `${project.taskIdToDisplayIndex[t.id]}`
      taskDisplayMap[tDisplay] = t.id
      const featureMap: Record<string,string> = {}
      for(const f of t.features){
        newFeaturesById[f.id] = f
        const fDisplay = `${t.featureIdToDisplayIndex[f.id]}`
        featureMap[fDisplay] = f.id
      }
      featureDisplayMapByTask[t.id] = featureMap
    }
    setTasksById(newTasksById)
    setFeaturesById(newFeaturesById)
    setTaskDisplayToId(taskDisplayMap)
    setFeatureDisplayToIdByTask(featureDisplayMapByTask)

    const outbound : Record<string,ResolvedRef[]> = {};
    for (const task of tasks) {
      for (const d of task.blockers || []) {
        const norm = normalizeDependencyInternal(project, taskDisplayMap, featureDisplayMapByTask, newTasksById, newFeaturesById, d)
        const parts = norm.split(".")
        if (parts.length > 1){
          if (!outbound[parts[1]]) outbound[parts[1]] = [];
          outbound[parts[1]].push({ kind: "task", id: task.id, taskId: task.id, task: task, display: `${project.taskIdToDisplayIndex[task.id]}`} as ResolvedTaskRef)
        }else{
          if (!outbound[parts[0]]) outbound[parts[0]] = [];
          outbound[parts[0]].push({ kind: "task", id: task.id, taskId: task.id, task: task, display: `${project.taskIdToDisplayIndex[task.id]}`} as ResolvedTaskRef)
        }
      }
      for (const feature of task.features) {
        for (const d of feature.blockers || []) {
          const norm = normalizeDependencyInternal(project, taskDisplayMap, featureDisplayMapByTask, newTasksById, newFeaturesById, d)
          const parts = norm.split(".")
          if (parts.length > 1){
            if (!outbound[parts[1]]) outbound[parts[1]] = [];
            outbound[parts[1]].push({ kind: "feature", id: `${task.id}.${feature.id}`, taskId: task.id, featureId: feature.id, task, feature, display: `${project.taskIdToDisplayIndex[task.id]}.${task.featureIdToDisplayIndex[feature.id]}` } as ResolvedFeatureRef)
          }else{
            if (!outbound[parts[0]]) outbound[parts[0]] = [];
            outbound[parts[0]].push({ kind: "feature", id: `${task.id}.${feature.id}`, taskId: task.id, featureId: feature.id, task, feature, display: `${project.taskIdToDisplayIndex[task.id]}.${task.featureIdToDisplayIndex[feature.id]}` } as ResolvedFeatureRef)
          }
        }
      }
    }
    setReferencesById(outbound)
  }

  useEffect(() => {
    update();

    const unsubscribe = tasksService.subscribe((tasks) => {
      if (project){
        updateCurrentProjectTasks(project, tasks)
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    update();
  }, [project]);

  function normalizeDependencyInternal(
    project: ProjectSpec | undefined,
    taskDispToId: Record<string,string>,
    featureDispToIdByTask: Record<string, Record<string,string>>,
    tasksIdx: Record<string, Task>,
    featuresIdx: Record<string, Feature>,
    dependency: string
  ): string {
    if (!project) return dependency
    const parts = dependency.split(".")
    if (parts.length === 1) {
      const a = parts[0]
      if (isUUID(a) && tasksIdx[a]) return a
      const taskId = taskDispToId[a]
      return taskId || dependency
    } else if (parts.length > 1) {
      const a = parts[0]
      const b = parts.slice(1).join('.') // in case of extra dots, treat rest as feature token
      let taskId = a
      if (!isUUID(a)) {
        taskId = taskDispToId[a] || a
      }
      let featureId = b
      if (!isUUID(b)) {
        const fmap = featureDispToIdByTask[taskId] || {}
        featureId = fmap[b] || b
      }
      return `${taskId}.${featureId}`
    }
    return dependency
  }

  const normalizeDependency = (dependency: string): string => {
    return normalizeDependencyInternal(project!, taskDisplayToId, featureDisplayToIdByTask, tasksById, featuresById, dependency)
  }

  const resolveDependency = (dependency: string) : ResolvedRef | InvalidRefError =>
  {
    if (!project) { return { id: dependency, code: 'EMPTY', message: "Task wasn't found" }}

    const normalized = normalizeDependencyInternal(project, taskDisplayToId, featureDisplayToIdByTask, tasksById, featuresById, dependency)

    const parts = normalized.split(".")
    const task = tasksById[parts[0]]
    if (!task){
      return { id: normalized, code: 'TASK_NOT_FOUND', message: "Task wasn't found" }
    }
    if (parts.length > 1){
      const feature = featuresById[parts[1]]
      if (!feature){
        return { id: normalized, code: 'FEATURE_NOT_FOUND', message: "Feature wasn't found" }
      }
      return { kind: "feature", id: normalized, taskId: parts[0], featureId: parts[1], task, feature, display: `${project.taskIdToDisplayIndex[task.id]}.${task.featureIdToDisplayIndex[feature.id]}`} as ResolvedFeatureRef
    }
    return { kind: "task", id: normalized, taskId: parts[0], task, display: `${project.taskIdToDisplayIndex[task.id]}` } as ResolvedTaskRef
  }

  const createTask = async (updates: TaskCreateInput) : Promise<ServiceResult> => {
    if (project){
      // normalize blockers if present
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }
      return await tasksService.createTask(project.id, normalized)
    }
    return { ok: false }
  }
  const updateTask = async (taskId: string, updates: Partial<Omit<Task,"id">>) : Promise<ServiceResult> => {
    if (project){
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }
      return await tasksService.updateTask(project.id, taskId, normalized)
    }
    return { ok: false }
  }

  const deleteTask = async (taskId: string) : Promise<ServiceResult> => {
    if (project){
      return await tasksService.deleteTask(project.id, taskId)
    }
    return { ok: false }
  }

  const addFeature = async (taskId: string, updates: Partial<Omit<Feature,"id">>) : Promise<ServiceResult> => {
    if (project){
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }
      return await tasksService.addFeature(project.id, taskId, normalized)
    }
    return { ok: false }
  }
  const updateFeature = async (taskId: string, featureId: string, updates: Partial<Omit<Feature,"id">>) : Promise<ServiceResult> => {
    if (project){
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }
      return await tasksService.updateFeature(project.id, taskId, featureId, normalized)
    }
    return { ok: false }
  }

  const deleteFeature = async (taskId: string, featureId: string) : Promise<ServiceResult> => {
    if (project){
      return await tasksService.deleteFeature(project.id, taskId, featureId)
    }
    return { ok: false }
  }

  const reorderFeatures = async (taskId: string, fromIndex: number, toIndex: number) : Promise<ServiceResult> => {
    if (project){
      return await tasksService.reorderFeatures(project.id, taskId, { fromIndex, toIndex })
    }
    return { ok: false }
  }
  

  const reorderTask = async (fromIndex: number, toIndex: number) : Promise<ServiceResult> => {
    if (project){
      return await projectsService.reorderTask(project.id, fromIndex, toIndex)
    }
    return { ok: false }
  }

  const getBlockers = (taskId: string, featureId?: string) : (ResolvedRef | InvalidRefError)[] => {
    if (featureId){
      return featuresById[featureId]?.blockers?.map(d => resolveDependency(d)) ?? []
    }
    return tasksById[taskId]?.blockers?.map(d => resolveDependency(d)) ?? []
  }
  const getBlockersOutbound = (id: string) : ResolvedRef[] => {
    return blockersOutboundById[id] ?? []
  }

  return { tasksById, createTask, updateTask, deleteTask, featuresById, addFeature, updateFeature, deleteFeature, reorderFeatures, reorderTask, getBlockersOutbound, getBlockers, resolveDependency, normalizeDependency };
}
