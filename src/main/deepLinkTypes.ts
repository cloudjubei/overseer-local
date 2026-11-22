/** The slice of Electron's `app` that opening `overseer://` links uses. */
export type DeepLinkApp = {
  requestSingleInstanceLock(): boolean
  quit(): void
  isReady(): boolean
  setAsDefaultProtocolClient(...args: ProtocolClientArgs): boolean
  on(event: 'open-url', listener: (event: { preventDefault(): void }, url: string) => void): unknown
  on(event: 'second-instance', listener: (event: unknown, argv: string[]) => void): unknown
}

/** The slice of Electron's `ipcMain` the page's listening signal arrives on. */
export type DeepLinkIpcMain = {
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): unknown
}

/** The slice of a `BrowserWindow` a link is shown in. */
export type DeepLinkWindow = {
  isMinimized(): boolean
  isDestroyed(): boolean
  restore(): void
  show(): void
  focus(): void
  on(event: 'closed', listener: () => void): unknown
  webContents: {
    send(channel: string, ...args: unknown[]): void
    on(event: 'did-navigate', listener: () => void): unknown
    on(event: 'render-process-gone', listener: () => void): unknown
  }
}

/** How this process was started, which decides how the scheme is registered. */
export type DeepLinkEnvironment = {
  argv: string[]
  defaultApp: boolean
  execPath: string
  resolvePath: (path: string) => string
}

export type DeepLinkDeps = {
  app: DeepLinkApp
  ipcMain: DeepLinkIpcMain
  environment: DeepLinkEnvironment
  getWindow: () => DeepLinkWindow | null
  openWindow: () => void
}

export type DeepLinkRegistration = {
  watchWindow: (window: DeepLinkWindow) => void
}

export type ProtocolClientArgs =
  | [protocol: string]
  | [protocol: string, path: string, args: string[]]
