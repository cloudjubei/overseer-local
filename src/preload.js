const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tasksIndex', {
  getSnapshot: () => ipcRenderer.invoke('tasks-index:get'),
  onUpdate: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('tasks-index:update', listener);
    return () => ipcRenderer.removeListener('tasks-index:update', listener);
  },

  updateTask: (taskId, data) => ipcRenderer.invoke('tasks:update', { taskId, data }),
  updateFeature: (taskId, featureId, data) => ipcRenderer.invoke('tasks-feature:update', { taskId, featureId, data }),
  addFeature: (taskId, feature) => ipcRenderer.invoke('tasks-feature:add', { taskId, feature }),
  deleteFeature: (taskId, featureId) => ipcRenderer.invoke('tasks-feature:delete', { taskId, featureId }),
  reorderFeatures: (taskId, payload) => ipcRenderer.invoke('tasks-features:reorder', { taskId, payload }),

  addTask: (task) => ipcRenderer.invoke('tasks:add', task),
  deleteTask: (taskId) => ipcRenderer.invoke('tasks:delete', { taskId }),
  reorderTasks: (payload) => ipcRenderer.invoke('tasks:reorder', payload),
  
  openFeatureCreate: (taskId) => ipcRenderer.invoke('feature-create:open', taskId),
  openTaskCreate: () => ipcRenderer.invoke('task-create:open'),
  openTaskEdit: (taskId) => ipcRenderer.invoke('task-edit:open', taskId),
  openFeatureEdit: (taskId, featureId) => ipcRenderer.invoke('feature-edit:open', taskId, featureId),

  // For modal windows to receive data
  onSetTaskId: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('set-task-id', listener);
    return () => ipcRenderer.removeListener('set-task-id', listener);
  }
});
