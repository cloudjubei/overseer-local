import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'

export default class BaseManager {
  public projectRoot: string
  public window: BrowserWindow
  private _ipcBound: boolean

  constructor(projectRoot: string, window: BrowserWindow) {
    this.projectRoot = projectRoot
    this.window = window
    this._ipcBound = false
  }
  async init(): Promise<void> {
    await this._registerIpcHandlers()
  }
  async stopWatching(): Promise<void> {
    return Promise.resolve()
  }
  getHandlers(): Record<string, (args: any) => any> {
    return {}
  }
  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    return {}
  }

  private async _registerIpcHandlers() {
    if (this._ipcBound) return

    const handlers: Record<string, (args: any) => any> = this.getHandlers()
    const handlersAsync: Record<string, (args: any) => Promise<any>> = this.getHandlersAsync()

    for (const handler of Object.keys(handlers)) {
      ipcMain.handle(handler, (_event, args) => {
        try {
          return handlers[handler](args)
        } catch (e: any) {
          console.error(`${handler} failed`, e)
        }
      })
    }
    for (const handler of Object.keys(handlersAsync)) {
      ipcMain.handle(handler, async (_event, args) => {
        try {
          return await handlersAsync[handler](args)
        } catch (e: any) {
          console.error(`${handler} failed`, e)
        }
      })
    }

    this._ipcBound = true
  }
}
