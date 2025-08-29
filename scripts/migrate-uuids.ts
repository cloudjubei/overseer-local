import { v4 as uuidv4 } from 'uuid';
import type { TasksIndexSnapshot } from '../src/types/external';
import type { ProjectSpec, Task, Feature } from '../src/types/tasks';

/**
 * Migrate numeric Task/Feature IDs to UUIDs and update all dependency references.
 * - Tasks and Features receive new UUID ids
 * - All dependencies ("{taskId}" or "{taskId}.{featureId}") are rewritten to new UUID refs
 * - Display indices are captured:
 *   - ProjectSpec.taskIdToDisplayIndex = 1-based position of each task in displayed order
 *   - Task.featureIdToDisplayIndex = 1-based position of each feature within its task
 * - Snapshot.orderedIds is remapped to new UUIDs preserving original ordering.
 */
export async function migrateToUUIDs(
  currentSnapshot: TasksIndexSnapshot,
  currentProject: ProjectSpec
): Promise<{ newSnapshot: TasksIndexSnapshot; newProject: ProjectSpec }> {
  // Determine original task order (prefer explicit orderedIds; fallback to numeric sort of ids)
  const oldOrder: string[] = (currentSnapshot.orderedIds && currentSnapshot.orderedIds.length)
    ? [...currentSnapshot.orderedIds]
    : Object.keys(currentSnapshot.tasksById).sort((a, b) => Number(a) - Number(b));

  // Maps from old refs to new
  const taskOldToNew = new Map<string, string>(); // oldTaskId -> newTaskId
  const featureOldToNew = new Map<string, string>(); // "oldTaskId.oldFeatureId" -> "newTaskId.newFeatureId"

  const newTasksById: Record<string, Task> = {};
  const newTaskIdToDisplayIndex: Record<string, number> = {};
  const newOrderedIds: string[] = [];
  const newTasksListOrdered: Task[] = [];

  // First pass: assign new IDs, build features and provisional deps (will re-map in pass 2)
  oldOrder.forEach((oldTaskId, tIndex) => {
    const task = currentSnapshot.tasksById[oldTaskId];
    if (!task) return;

    const newTaskId = uuidv4();
    taskOldToNew.set(oldTaskId, newTaskId);
    newTaskIdToDisplayIndex[newTaskId] = tIndex + 1; // 1-based display index
    newOrderedIds.push(newTaskId);

    const newFeatures: Feature[] = [];
    const newFeatureIdToDisplayIndex: Record<string, number> = {};

    (task.features || []).forEach((feat, fIndex) => {
      const oldFeatId = feat.id;
      const newFeatId = uuidv4();
      featureOldToNew.set(`${oldTaskId}.${oldFeatId}`, `${newTaskId}.${newFeatId}`);
      newFeatureIdToDisplayIndex[newFeatId] = fIndex + 1; // 1-based display index

      // Provisional dependency mapping (finalized in second pass after all features mapped)
      const provisionalDeps = (feat.dependencies || []).map((dep) =>
        taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep
      );

      const newFeat: Feature = {
        ...feat,
        id: newFeatId,
        dependencies: provisionalDeps,
      };
      newFeatures.push(newFeat);
    });

    // Provisional task dependency mapping (finalized in second pass)
    const provisionalTaskDeps = (task.dependencies || []).map((dep) =>
      taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep
    );

    const newTask: Task = {
      ...task,
      id: newTaskId,
      features: newFeatures,
      featureIdToDisplayIndex: newFeatureIdToDisplayIndex,
      dependencies: provisionalTaskDeps,
    } as Task;

    newTasksById[newTaskId] = newTask;
    newTasksListOrdered.push(newTask);
  });

  // Second pass: finalize dependency mappings now that all features have new IDs
  for (const newTask of Object.values(newTasksById)) {
    newTask.dependencies = (newTask.dependencies || []).map((dep) =>
      taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep
    );
    newTask.features = newTask.features.map((feat) => ({
      ...feat,
      dependencies: (feat.dependencies || []).map((dep) =>
        taskOldToNew.get(dep) || featureOldToNew.get(dep) || dep
      ),
    }));
  }

  const newSnapshot: TasksIndexSnapshot = {
    ...currentSnapshot,
    tasksById: newTasksById,
    orderedIds: newOrderedIds,
  };

  const newProject: ProjectSpec = {
    ...currentProject,
    tasks: newTasksListOrdered,
    taskIdToDisplayIndex: newTaskIdToDisplayIndex,
  };

  return { newSnapshot, newProject };
}
