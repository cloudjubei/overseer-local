import { v4 as uuidv4 } from 'uuid';
import type { TasksIndexSnapshot } from '../types/external';
import type { ProjectSpec, Task, Feature } from '../src/types/tasks';

export async function migrateToUUIDs(currentSnapshot: TasksIndexSnapshot, currentProject: ProjectSpec): Promise<{ newSnapshot: TasksIndexSnapshot; newProject: ProjectSpec }> {
  const taskOldToNew = new Map<string, string>();
  const featureOldToNew = new Map<string, string>();

  const sortedTasks = Object.entries(currentSnapshot.tasksById).sort((a, b) => Number(a[0]) - Number(b[0]));

  const newTasksById: Record<string, Task> = {};
  const newTaskIdToDisplayIndex: Record<string, number> = {};

  sortedTasks.forEach(([oldId, task], index) => {
    const newId = uuidv4();
    taskOldToNew.set(oldId, newId);
    newTaskIdToDisplayIndex[newId] = index + 1;

    const newFeatures: Feature[] = [];
    const newFeatureIdToDisplayIndex: Record<string, number> = {};

    (task.features || []).forEach((feat, fIndex) => {
      const oldFeatId = feat.id;
      const newFeatId = uuidv4();
      const oldFull = `${oldId}.${oldFeatId}`;
      const newFull = `${newId}.${newFeatId}`;
      featureOldToNew.set(oldFull, newFull);
      newFeatureIdToDisplayIndex[newFeatId] = fIndex + 1;

      const newFeat: Feature = {
        ...feat,
        id: newFeatId,
        dependencies: (feat.dependencies || []).map(dep => taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep),
      };
      newFeatures.push(newFeat);
    });

    const newTask: Task = {
      ...task,
      id: newId,
      features: newFeatures,
      featureIdToDisplayIndex: newFeatureIdToDisplayIndex,
      dependencies: (task.dependencies || []).map(dep => taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep),
    };
    newTasksById[newId] = newTask;
  });

  // Second pass for dependencies
  Object.values(newTasksById).forEach(task => {
    task.dependencies = (task.dependencies || []).map(dep => taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep);
    task.features.forEach(feat => {
      feat.dependencies = (feat.dependencies || []).map(dep => taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep);
    });
  });

  const newSnapshot: TasksIndexSnapshot = { ...currentSnapshot, tasksById: newTasksById };

  const newProject: ProjectSpec = {
    ...currentProject,
    tasks: Object.values(newTasksById),
    taskIdToDisplayIndex: newTaskIdToDisplayIndex,
  };

  return { newSnapshot, newProject };
}
