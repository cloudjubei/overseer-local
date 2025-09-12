import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { InvalidRefError, ResolvedFeatureRef, ResolvedRef, ResolvedTaskRef, TaskCreateInput, tasksService } from '../services/tasksService';
import { projectsService } from '../services/projectsService';
import { useActiveProject } from './ProjectContext';
import { Feature, ProjectSpec, Task } from 'thefactory-tools';
import { ServiceResult } from '../services/serviceResult';

// Define the context value type based on useTasks return value
export type TasksContextValue = {
  tasksById: Record<string, Task>;
  featuresById: Record<string, Feature>;
  createTask: (updates: TaskCreateInput) => Promise<ServiceResult>;
  updateTask: (taskId: string, updates: Partial<Omit<Task, "id">>) => Promise<ServiceResult>;
  deleteTask: (taskId: string) => Promise<ServiceResult>;
  addFeature: (taskId: string, updates: Partial<Omit<Feature, "id">>) => Promise<ServiceResult>;
  updateFeature: (taskId: string, featureId: string, updates: Partial<Omit<Feature, "id">>) => Promise<ServiceResult>;
  deleteFeature: (taskId: string, featureId: string) => Promise<ServiceResult>;
  reorderFeatures: (taskId: string, fromIndex: number, toIndex: number) => Promise<ServiceResult>;
  reorderTask: (fromIndex: number, toIndex: number) => Promise<ServiceResult>;
  getBlockers: (taskId: string, featureId?: string) => (ResolvedRef | InvalidRefError)[];
  getBlockersOutbound: (id: string) => ResolvedRef[];
  resolveDependency: (dependency: string) => ResolvedRef | InvalidRefError;
  normalizeDependency: (dependency: string) => string;
};

// Create the context
const TasksContext = createContext<TasksContextValue | null>(null);

function isUUID(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
}

function normalizeDependencyInternal(
  project: ProjectSpec,
  taskDispToId: Record<string,string>,
  featureDispToIdByTask: Record<string, Record<string,string>>,
  tasksIdx: Record<string, Task>,
  featuresIdx: Record<string, Feature>,
  dependency: string
): string {
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

// Create the provider component
export function TasksProvider({ children }: { children: React.ReactNode }) {
  const {
    project
  } = useActiveProject()

  const [tasksById, setTasksById] = useState<Record<string,Task>>({});
  const [featuresById, setFeaturesById] = useState<Record<string,Feature>>({});
  const [blockersOutboundById, setReferencesById] = useState<Record<string,ResolvedRef[]>>({});
  const [taskDisplayToId, setTaskDisplayToId] = useState<Record<string,string>>({});
  const [featureDisplayToIdByTask, setFeatureDisplayToIdByTask] = useState<Record<string, Record<string,string>>>({});
  
  const updateCurrentProjectTasks = useCallback((project: ProjectSpec, tasks: Task[]) => {
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
  }, [])

  useEffect(() => {
    if (!project) {
      setTasksById({});
      setFeaturesById({});
      setReferencesById({});
      setTaskDisplayToId({});
      setFeatureDisplayToIdByTask({});
      return;
    }

    let isMounted = true;

    const updateForProject = async () => {
      const tasks = await tasksService.listTasks(project.id);
      if (isMounted) {
        updateCurrentProjectTasks(project, tasks);
      }
    };

    updateForProject();

    const unsubscribe = tasksService.subscribe((tasks) => {
      if (isMounted) {
        updateCurrentProjectTasks(project, tasks);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [project, updateCurrentProjectTasks]);

  const normalizeDependency = useCallback((dependency: string): string => {
    if (!project) return dependency;
    return normalizeDependencyInternal(project, taskDisplayToId, featureDisplayToIdByTask, tasksById, featuresById, dependency)
  }, [project, taskDisplayToId, featureDisplayToIdByTask, tasksById, featuresById]);

  const resolveDependency = useCallback((dependency: string) : ResolvedRef | InvalidRefError =>
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
  }, [project, taskDisplayToId, featureDisplayToIdByTask, tasksById, featuresById]);

  const createTask = useCallback(async (updates: TaskCreateInput) : Promise<ServiceResult> => {
    if (project){
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }
      return await tasksService.createTask(project.id, normalized)
    }
    return { ok: false }
  }, [project, normalizeDependency]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Omit<Task,"id">>) : Promise<ServiceResult> => {
    if (project){
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }
      return await tasksService.updateTask(project.id, taskId, normalized)
    }
    return { ok: false }
  }, [project, normalizeDependency]);

  const deleteTask = useCallback(async (taskId: string) : Promise<ServiceResult> => {
    if (project){
      return await tasksService.deleteTask(project.id, taskId)
    }
    return { ok: false }
  }, [project]);

  const addFeature = useCallback(async (taskId: string, updates: Partial<Omit<Feature,"id">>) : Promise<ServiceResult> => {
    if (project){
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }
      return await tasksService.addFeature(project.id, taskId, normalized)
    }
    return { ok: false }
  }, [project, normalizeDependency]);

  const updateFeature = useCallback(async (taskId: string, featureId: string, updates: Partial<Omit<Feature,"id">>) : Promise<ServiceResult> => {
    if (project){
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }
      return await tasksService.updateFeature(project.id, taskId, featureId, normalized)
    }
    return { ok: false }
  }, [project, normalizeDependency]);

  const deleteFeature = useCallback(async (taskId: string, featureId: string) : Promise<ServiceResult> => {
    if (project){
      return await tasksService.deleteFeature(project.id, taskId, featureId)
    }
    return { ok: false }
  }, [project]);

  const reorderFeatures = useCallback(async (taskId: string, fromIndex: number, toIndex: number) : Promise<ServiceResult> => {
    if (project){
      return await tasksService.reorderFeatures(project.id, taskId, { fromIndex, toIndex })
    }
    return { ok: false }
  }, [project]);
  
  const reorderTask = useCallback(async (fromIndex: number, toIndex: number) : Promise<ServiceResult> => {
    if (project){
      return await projectsService.reorderTask(project.id, fromIndex, toIndex)
    }
    return { ok: false }
  }, [project]);

  const getBlockers = useCallback((taskId: string, featureId?: string) : (ResolvedRef | InvalidRefError)[] => {
    if (featureId){
      return featuresById[featureId]?.blockers?.map(d => resolveDependency(d)) ?? []
    }
    return tasksById[taskId]?.blockers?.map(d => resolveDependency(d)) ?? []
  }, [featuresById, tasksById, resolveDependency]);
  
  const getBlockersOutbound = useCallback((id: string) : ResolvedRef[] => {
    return blockersOutboundById[id] ?? []
  }, [blockersOutboundById]);

  const value = useMemo<TasksContextValue>(() => ({ 
    tasksById, 
    featuresById,
    createTask, 
    updateTask, 
    deleteTask, 
    addFeature, 
    updateFeature, 
    deleteFeature, 
    reorderFeatures, 
    reorderTask, 
    getBlockersOutbound, 
    getBlockers, 
    resolveDependency, 
    normalizeDependency 
  }), [
    tasksById, 
    featuresById,
    createTask, 
    updateTask, 
    deleteTask, 
    addFeature, 
    updateFeature, 
    deleteFeature, 
    reorderFeatures, 
    reorderTask, 
    getBlockersOutbound, 
    getBlockers, 
    resolveDependency, 
    normalizeDependency
  ]);

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

// Create the consumer hook
export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
}
