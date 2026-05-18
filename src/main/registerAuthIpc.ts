import { ipcMain, safeStorage, app } from 'electron'
import { join } from 'node:path'
import IPC_HANDLER_KEYS from '../preload/ipcHandlersKeys'
import { createAuthStore, type AuthState, type AuthStore } from './authStore'

/**
 * Wires the auth IPC surface (`auth:get|set|clear`) against an `AuthStore`
 * backed by Electron's `safeStorage`. Default store path is
 * `<userData>/auth.bin`. The IPC contract is the minimum needed to back
 * the renderer's `AuthContext`.
 */
export function registerAuthIpc(opts?: { store?: AuthStore }): () => void {
  const store: AuthStore =
    opts?.store ??
    createAuthStore({
      storeFile: join(app.getPath('userData'), 'auth.bin'),
      cipher: safeStorage,
    })

  const handlers: Record<string, (args: unknown) => unknown> = {
    [IPC_HANDLER_KEYS.AUTH_GET]: () => store.read(),
    [IPC_HANDLER_KEYS.AUTH_SET]: (args) => {
      const next = (args ?? {}) as Partial<AuthState>
      store.write({ baseUrl: next.baseUrl ?? null, token: next.token ?? null })
      return store.read()
    },
    [IPC_HANDLER_KEYS.AUTH_CLEAR]: () => {
      store.clear()
      return store.read()
    },
  }

  for (const [key, handler] of Object.entries(handlers)) {
    ipcMain.handle(key, (_event, args) => handler(args))
  }

  return () => {
    for (const key of Object.keys(handlers)) ipcMain.removeHandler(key)
  }
}
