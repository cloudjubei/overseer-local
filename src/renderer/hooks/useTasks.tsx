import { useEffect, useState } from 'react';
import { InvalidRefError, ResolvedRef, tasksService } from '../services/tasksService';
import { projectsService } from '../services/projectsService';
import { useActiveProject } from '../projects/ProjectContext';
import { Task } from 'src/types/tasks';
import { ServiceResult } from '../services/serviceResult';

export function useTasks() {
  const {
    project
  } = useActiveProject()

  const [tasksById, setTasksById] = useState<Record<string,Task>>({});

  const updateCurrentProjectTasks = async () => {
    if (project){
      const tasks = await tasksService.listTasks(project)
      const newTasksById : Record<string,Task> = {}
      for(const t of tasks){
        newTasksById[t.id] = t
      }
      setTasksById(newTasksById)
    }
  }

  useEffect(() => {
    updateCurrentProjectTasks();

    const unsubscribe = tasksService.subscribe(updateCurrentProjectTasks);

    return () => {
      unsubscribe();
    };
  }, []);

  const updateTask = async (taskId: string, updates: Partial<Omit<Task,"id">>) : Promise<ServiceResult> => {
    if (project){
      return await tasksService.updateTask(project, taskId, updates)
    }
    return { ok: false }
  }

  const reorderTasks = async (fromIndex: number, toIndex: number) : Promise<ServiceResult> => {
    if (project){
      return await projectsService.reorderTasks(project, fromIndex, toIndex)
    }
    return { ok: false }
  }

  const validateReference = (reference: string) : ServiceResult => {
    if (project){
      return tasksService.validateReference(project, reference)
    }
    return { ok: false } 
  }
  const validateReferences = (reference: string | null, proposed: string[]) : (ResolvedRef | InvalidRefError)[] => {
    if (project){
      return tasksService.validateReferences(project, reference, proposed)
    }
    return []
  }

  const getReferencesOutbound = (taskId: string) : ResolvedRef[] => {
    if (project){
      return tasksService.getReferencesOutbound(project, taskId)
    }
    return []
  }
  const getReferencesInbound = (taskId: string) : ResolvedRef[] => {
    if (project){
      return tasksService.getReferencesInbound(project, taskId)
    }
    return []
  }

  return { tasksById, updateTask, reorderTasks, getReferencesOutbound, getReferencesInbound, validateReference, validateReferences };
}
