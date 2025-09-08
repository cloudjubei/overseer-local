import { contextBridge, ipcRenderer } from 'electron';
import IPC_HANDLER_KEYS from './ipcHandlersKeys';

contextBridge.exposeInMainWorld('liveData', {
  getStatus: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.LIVE_DATA_GET_STATUS),
  triggerUpdate: (serviceId) => ipcRenderer.invoke(IPC_HANDLER_KEYS.LIVE_DATA_TRIGGER_UPDATE, { serviceId }),
  updateConfig: (serviceId, updates) => ipcRenderer.invoke(IPC_HANDLER_KEYS.LIVE_DATA_UPDATE_CONFIG, { serviceId, updates }),
  onStatusUpdated: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(IPC_HANDLER_KEYS.LIVE_DATA_STATUS_UPDATED, listener);
    return () => ipcRenderer.removeListener(IPC_HANDLER_KEYS.LIVE_DATA_STATUS_UPDATED, listener);
  },
});
