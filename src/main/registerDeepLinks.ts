import IPC_HANDLER_KEYS from '../preload/ipcHandlersKeys'
import { DeepLinkInbox } from './deepLinkInbox'
import { findDeepLinkInArgv, normaliseDeepLink, protocolClientArgs } from './deepLinkUtils'
import type { DeepLinkDeps, DeepLinkRegistration, DeepLinkWindow } from './deepLinkTypes'

function bringForward(window: DeepLinkWindow): void {
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

/**
 * Makes `overseer://` links opened anywhere on the machine open in this app.
 * Takes the single-instance lock — a second launch quits, its link handed to
 * the first through `second-instance` — and registers the scheme with the OS.
 * Links arrive from macOS `open-url`, a second launch's arguments, or this
 * launch's own; each brings the window forward and is held until the page
 * listens, then sent on `DEEP_LINK_OPEN`. Returns `undefined` when another
 * instance owns the app. Call before `ready`, so a link that starts the app on
 * macOS is not missed.
 */
export function registerDeepLinks(deps: DeepLinkDeps): DeepLinkRegistration | undefined {
  const { app, ipcMain, environment, getWindow, openWindow } = deps
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return undefined
  }
  app.setAsDefaultProtocolClient(...protocolClientArgs(environment))

  const inbox = new DeepLinkInbox((url) => {
    const window = getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC_HANDLER_KEYS.DEEP_LINK_OPEN, url)
    }
  })

  const receive = (link: string | undefined): void => {
    const window = getWindow()
    if (window && !window.isDestroyed()) bringForward(window)
    else if (app.isReady()) openWindow()
    if (link) inbox.receive(link)
  }

  app.on('open-url', (event, url) => {
    event.preventDefault()
    receive(normaliseDeepLink(url))
  })
  app.on('second-instance', (_event, argv) => receive(findDeepLinkInArgv(argv)))
  ipcMain.on(IPC_HANDLER_KEYS.DEEP_LINK_LISTENING, (_event, listening) =>
    inbox.setListening(listening === true),
  )

  const launchLink = findDeepLinkInArgv(environment.argv)
  if (launchLink) inbox.receive(launchLink)

  return {
    watchWindow: (window) => {
      const stopListening = (): void => inbox.setListening(false)
      window.webContents.on('did-navigate', stopListening)
      window.webContents.on('render-process-gone', stopListening)
      window.on('closed', stopListening)
    },
  }
}
