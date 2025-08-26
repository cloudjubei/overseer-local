export type TasksIndexSnapshot = any

export type TasksService = {
  getSnapshot: () => Promise<TasksIndexSnapshot>
  onUpdate: (callback: (snapshot: TasksIndexSnapshot) => void) => () => void
  addTask: (task: any) => Promise<any>
  updateTask: (taskId: number, data: any) => Promise<any>
  deleteTask: (taskId: number) => Promise<any>
  addFeature: (taskId: number, feature: any) => Promise<any>
  updateFeature: (taskId: number, featureId: string, data: any) => Promise<any>
  deleteFeature: (taskId: number, featureId: string) => Promise<any>
  reorderFeatures: (taskId: number, payload: any) => Promise<any>
  reorderTasks: (payload: any) => Promise<any>
}

export const tasksService: TasksService = {
  getSnapshot: () => window.tasksIndex.getSnapshot(),
  onUpdate: (callback) => window.tasksIndex.onUpdate(callback),
  addTask: (task) => window.tasksIndex.addTask(task),
  updateTask: (taskId, data) => window.tasksIndex.updateTask(taskId, data),
  deleteTask: (taskId) => window.tasksIndex.deleteTask(taskId),
  addFeature: (taskId, feature) => window.tasksIndex.addFeature(taskId, feature),
  updateFeature: (taskId, featureId, data) => window.tasksIndex.updateFeature(taskId, featureId, data),
  deleteFeature: (taskId, featureId) => window.tasksIndex.deleteFeature(taskId, featureId),
  reorderFeatures: (taskId, payload) => window.tasksIndex.reorderFeatures(taskId, payload),
  reorderTasks: (payload) => window.tasksIndex.reorderTasks(payload),
}
