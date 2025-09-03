import { useEffect, useState } from 'react';
import { InvalidRefError, ResolvedFeatureRef, ResolvedRef, ResolvedTaskRef, TaskCreateInput, tasksService } from '../services/tasksService';
import { projectsService } from '../services/projectsService';
import { useActiveProject } from '../projects/ProjectContext';
import { Feature, ProjectSpec, Task } from 'packages/factory-ts/src/types'
import { ServiceResult } from '../services/serviceResult';

export function useTasks() {
  const {
    project
  } = useActiveProject()

  const [tasksById, setTasksById] = useState<Record<string,Task>>({});
  const [featuresById, setFeaturesById] = useState<Record<string,Feature>>({});
  const [blockersOutboundById, setReferencesById] = useState<Record<string,ResolvedRef[]>>({});

  const update = async () => {
    if (project){
      const tasks = await tasksService.listTasks(project.id)
      updateCurrentProjectTasks(project, tasks)
    }
  }
  const updateCurrentProjectTasks = (project: ProjectSpec, tasks: Task[]) => {
    const newTasksById : Record<string,Task> = {}
    const newFeaturesById : Record<string,Feature> = {}
    for(const t of tasks){
      newTasksById[t.id] = t
      for(const f of t.features){
        newFeaturesById[f.id] = f
      }
    }
    setTasksById(newTasksById)
    setFeaturesById(newFeaturesById)

    const outbound : Record<string,ResolvedRef[]> = {};
    for (const task of tasks) {
      for (const d of task.blockers || []) {
        const parts = d.split(".")
        if (parts.length > 1){
          if (!outbound[parts[1]]) outbound[parts[1]] = [];
          outbound[parts[1]].push({ id: task.id, taskId: task.id, task: task, display: `${project.taskIdToDisplayIndex[task.id]}`} as ResolvedTaskRef)
        }else{
          if (!outbound[parts[0]]) outbound[parts[0]] = [];
          outbound[parts[0]].push({ id: task.id, taskId: task.id, task: task, display: `${project.taskIdToDisplayIndex[task.id]}`} as ResolvedTaskRef)
        }
      }
      for (const feature of task.features) {
        for (const d of feature.blockers || []) {
          const parts = d.split(".")
          if (parts.length > 1){
            if (!outbound[parts[1]]) outbound[parts[1]] = [];
            outbound[parts[1]].push({ id: `${task.id}.${feature.id}`, taskId: task.id, featureId: feature.id, task, feature, display: `${project.taskIdToDisplayIndex[task.id]}.${task.featureIdToDisplayIndex[feature.id]}` } as ResolvedFeatureRef)
          }else{
            if (!outbound[parts[0]]) outbound[parts[0]] = [];
            outbound[parts[0]].push({ id: `${task.id}.${feature.id}`, taskId: task.id, featureId: feature.id, task, feature, display: `${project.taskIdToDisplayIndex[task.id]}.${task.featureIdToDisplayIndex[feature.id]}` } as ResolvedFeatureRef)
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

  const resolveDependency = (dependency: string) : ResolvedRef | InvalidRefError =>
  {
    if (!project) { return { id: dependency, code: 'EMPTY', message: "Task wasn't found" }}

    const parts = dependency.split(".")
    const task = tasksById[parts[0]]
    if (!task){
      return { id: dependency, code: 'TASK_NOT_FOUND', message: "Task wasn't found" }
    }
    if (parts.length > 1){
      const feature = featuresById[parts[1]]
      if (!feature){
        return { id: dependency, code: 'FEATURE_NOT_FOUND', message: "Feature wasn't found" }
      }
      return { id: dependency, taskId: parts[0], featureId: parts[1], task, feature, display: `${project.taskIdToDisplayIndex[task.id]}.${task.featureIdToDisplayIndex[feature.id]}`} as ResolvedFeatureRef
    }
    return { id: dependency, taskId: parts[0], task, display: `${project.taskIdToDisplayIndex[task.id]}` } as ResolvedTaskRef
  }

  const createTask = async (updates: TaskCreateInput) : Promise<ServiceResult> => {
    if (project){
      return await tasksService.createTask(project.id, updates)
    }
    return { ok: false }
  }
  const updateTask = async (taskId: string, updates: Partial<Omit<Task,"id">>) : Promise<ServiceResult> => {
    if (project){
      return await tasksService.updateTask(project.id, taskId, updates)
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
      return await tasksService.addFeature(project.id, taskId, updates)
    }
    return { ok: false }
  }
  const updateFeature = async (taskId: string, featureId: string, updates: Partial<Omit<Feature,"id">>) : Promise<ServiceResult> => {
    if (project){
      return await tasksService.updateFeature(project.id, taskId, featureId, updates)
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

  return { tasksById, createTask, updateTask, deleteTask, featuresById, addFeature, updateFeature, deleteFeature, reorderFeatures, reorderTask, getBlockersOutbound, getBlockers, resolveDependency };
}
