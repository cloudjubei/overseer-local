import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import IPC_HANDLER_KEYS from './ipcHandlersKeys'

const AUTH_API = {
  get: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.AUTH_GET),
  set: (state) => ipcRenderer.invoke(IPC_HANDLER_KEYS.AUTH_SET, state),
  clear: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.AUTH_CLEAR),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('authService', AUTH_API)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.authService = AUTH_API
}
