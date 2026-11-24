import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import IPC_HANDLER_KEYS from './ipcHandlersKeys'
import { APP_SNAPSHOT_ENABLED } from './appSnapshotAvailability'
import type { AppSnapshotService } from './appSnapshotTypes'

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

// Keep the native click in the isolated world. A synthetic .click(), a
// different control, or a later call with transient activation cannot arm it.
let captureClick: MouseEvent | undefined
if (APP_SNAPSHOT_ENABLED && process.contextIsolated && process.isMainFrame) {
  window.addEventListener(
    'click',
    (event) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null
      captureClick =
        event.isTrusted &&
        button &&
        !button.disabled &&
        button.closest('dialog[data-chat-app-snapshot]:modal [data-app-capture-ready]')
          ? event
          : undefined
    },
    { capture: true },
  )
}

const APP_SNAPSHOT_API: AppSnapshotService = {
  capture: async (id) => {
    const click = captureClick
    captureClick = undefined
    if (!click || click.eventPhase === Event.NONE || !navigator.userActivation.isActive) {
      throw new Error('Press Capture to take an app snapshot.')
    }
    const permit = await ipcRenderer.invoke(IPC_HANDLER_KEYS.APP_SNAPSHOT_AUTHORIZE, id)
    return ipcRenderer.invoke(IPC_HANDLER_KEYS.APP_SNAPSHOT, id, permit)
  },
  cancel: (id) => ipcRenderer.invoke(IPC_HANDLER_KEYS.APP_SNAPSHOT_CANCEL, id),
}

if (process.contextIsolated && process.isMainFrame) {
  try {
    contextBridge.exposeInMainWorld('authService', AUTH_API)
    contextBridge.exposeInMainWorld('systemDictation', SYSTEM_DICTATION_API)
    contextBridge.exposeInMainWorld('deepLinks', DEEP_LINKS_API)
    if (APP_SNAPSHOT_ENABLED) contextBridge.exposeInMainWorld('appSnapshot', APP_SNAPSHOT_API)
  } catch (error) {
    console.error(error)
  }
} else if (process.isMainFrame) {
  // @ts-ignore (define in dts)
  window.authService = AUTH_API
  // @ts-ignore (define in dts)
  window.systemDictation = SYSTEM_DICTATION_API
  // @ts-ignore (define in dts)
  window.deepLinks = DEEP_LINKS_API
}
