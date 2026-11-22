import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
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

/**
 * Bridge for `overseer://` links opened outside the app. Subscribing tells the
 * main process the page listens, so a held link is sent now; unsubscribing
 * makes it hold links again.
 */
const DEEP_LINKS_API = {
  onOpen: (listener: (url: string) => void) => {
    const handle = (_event: IpcRendererEvent, url: string): void => listener(url)
    ipcRenderer.on(IPC_HANDLER_KEYS.DEEP_LINK_OPEN, handle)
    ipcRenderer.send(IPC_HANDLER_KEYS.DEEP_LINK_LISTENING, true)
    return () => {
      ipcRenderer.removeListener(IPC_HANDLER_KEYS.DEEP_LINK_OPEN, handle)
      ipcRenderer.send(IPC_HANDLER_KEYS.DEEP_LINK_LISTENING, false)
    }
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('authService', AUTH_API)
    contextBridge.exposeInMainWorld('systemDictation', SYSTEM_DICTATION_API)
    contextBridge.exposeInMainWorld('deepLinks', DEEP_LINKS_API)
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
  // @ts-ignore (define in dts)
  window.deepLinks = DEEP_LINKS_API
}
