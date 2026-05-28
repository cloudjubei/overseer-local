import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import IPC_HANDLER_KEYS from './ipcHandlersKeys'

const AUTH_API = {
  get: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.AUTH_GET),
  set: (state) => ipcRenderer.invoke(IPC_HANDLER_KEYS.AUTH_SET, state),
  clear: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.AUTH_CLEAR),
}

/**
 * Bridge to the main-process macOS Dictation trigger. `trigger()`
 * resolves with the same `NativeDictationResult` shape the
 * `useNativeDictationTrigger` hook expects, so the renderer can pass
 * it straight through. `openSettings()` deep-links into the
 * Accessibility pane when the user needs to grant permission.
 */
const SYSTEM_DICTATION_API = {
  trigger: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.SYSTEM_DICTATION_TRIGGER),
  openSettings: () => ipcRenderer.invoke(IPC_HANDLER_KEYS.SYSTEM_DICTATION_OPEN_SETTINGS),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('authService', AUTH_API)
    contextBridge.exposeInMainWorld('systemDictation', SYSTEM_DICTATION_API)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.authService = AUTH_API
  // @ts-ignore (define in dts)
  window.systemDictation = SYSTEM_DICTATION_API
}
