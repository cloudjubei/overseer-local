import { randomUUID } from 'node:crypto'
import { ipcMain, screen, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { APP_SNAPSHOT_ENABLED } from '../preload/appSnapshotAvailability'
import IPC_HANDLER_KEYS from '../preload/ipcHandlersKeys'
import { createSnapshotCapture, isGrantedApp, type Surface } from './appSnapshot'
import type { AuthStore } from './authStore'

// Runs in an isolated world of the trusted shell, never inside the app frame.
// The host marks only its chat-owned surface, during the explicit capture action.
// No coordinate, selector, window, URL, or path comes from the IPC caller.
async function measureSurface(requestId: string): Promise<Surface | null> {
  const painted = await new Promise<boolean>((resolve) => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        clearTimeout(timer)
        resolve(true)
      })
    })
    const timer = setTimeout(() => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
      resolve(false)
    }, 1000)
  })
  if (!painted) return null
  const dialog = document.querySelector('dialog[data-chat-app-snapshot]:modal')
  const container = dialog?.querySelector('[data-snapshot-request]')
  if (!container || container.getAttribute('data-snapshot-request') !== requestId) return null
  const iframe = container.querySelector('iframe')
  if (
    !iframe?.contentWindow ||
    window.length !== 1 ||
    window[0] !== iframe.contentWindow ||
    !iframe.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  )
    return null
  if (
    document.visibilityState !== 'visible' ||
    visualViewport?.scale !== 1 ||
    visualViewport.offsetLeft ||
    visualViewport.offsetTop
  )
    return null
  const { left, top, right, bottom } = iframe.getBoundingClientRect()
  if (left < 0 || top < 0 || right > innerWidth || bottom > innerHeight) return null

  // The dialog is the top-layer host and the iframe is its only painted child
  // in this region. Reject clipping/transforms and check the hit-test edges and
  // interior (e.g. another modal or an active picker covering the frame).
  if (
    container.querySelectorAll('*').length !== 2 ||
    document.querySelectorAll(':modal').length !== 1
  )
    return null
  for (let node: Element | null = iframe; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (
      style.transform !== 'none' ||
      style.clipPath !== 'none' ||
      style.filter !== 'none' ||
      style.opacity !== '1'
    )
      return null
    if (node === iframe) continue
    const r = node.getBoundingClientRect()
    if (
      (style.overflowX !== 'visible' && (left < r.left || right > r.right)) ||
      (style.overflowY !== 'visible' && (top < r.top || bottom > r.bottom))
    )
      return null
    if (node === dialog) break
  }
  for (const x of [left + 0.5, (left + right) / 2, right - 0.5]) {
    for (const y of [top + 0.5, (top + bottom) / 2, bottom - 0.5]) {
      if (document.elementFromPoint(x, y) !== iframe) return null
    }
  }
  return {
    left,
    top,
    right,
    bottom,
    dpr: devicePixelRatio,
    src: iframe.src,
    projectId: container.getAttribute('data-project-id') ?? '',
  }
}

const documentURL = (url: string): string => url.split('#', 1)[0]

function onlyChild(mainFrame: BrowserWindow['webContents']['mainFrame']): {
  frame: string
  url: string
  origin: string
} | null {
  const frames = mainFrame.frames
  if (frames.length !== 1) return null
  const [child] = frames
  if (child.detached || !child.frameToken) return null
  return {
    frame: `${child.frameTreeNodeId}:${child.processId}:${child.frameToken}`,
    url: documentURL(child.url),
    origin: child.origin,
  }
}

const PERMIT_TTL_MS = 1000

type CapturePermit = { request: string; secret: string; expires: number }

type TrackedWindow = {
  window: BrowserWindow
  shell: string
  capture: ReturnType<typeof createSnapshotCapture>
  permit?: CapturePermit
}

type AppSnapshotIpc = {
  revokeAuth: () => void
  watch: (window: BrowserWindow, shellURL: string) => void
}

export function registerAppSnapshotIpc(store: AuthStore): AppSnapshotIpc | undefined {
  if (!APP_SNAPSHOT_ENABLED) return undefined
  let tracked: TrackedWindow | undefined
  let authEpoch = 0
  function authorized(event: IpcMainInvokeEvent): TrackedWindow {
    const current = tracked
    if (!current || current.window.isDestroyed()) throw new Error('App window is closed.')
    const wc = current.window.webContents
    if (
      wc.isDestroyed() ||
      event.sender !== wc ||
      !event.senderFrame ||
      event.senderFrame !== wc.mainFrame ||
      documentURL(event.senderFrame.url) !== current.shell
    ) {
      throw new Error('Only the app shell can request a snapshot.')
    }
    return current
  }

  function revokePermit(window: BrowserWindow): void {
    if (tracked?.window === window) tracked.permit = undefined
  }

  // Only the isolated preload can invoke this channel. Do not expose raw IPC
  // or return the permit through contextBridge. DOM attributes are geometry
  // markers, not proof of a user gesture.
  ipcMain.handle(IPC_HANDLER_KEYS.APP_SNAPSHOT_AUTHORIZE, (event, id: unknown) => {
    const current = authorized(event)
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) {
      throw new Error('Invalid app snapshot request.')
    }
    const secret = randomUUID()
    current.permit = { request: id, secret, expires: performance.now() + PERMIT_TTL_MS }
    return secret
  })
  ipcMain.handle(IPC_HANDLER_KEYS.APP_SNAPSHOT, (event, ...args: unknown[]) => {
    const current = authorized(event)
    const permit = current.permit
    if (args.length !== 2 || !permit || args[0] !== permit.request || args[1] !== permit.secret) {
      throw new Error('Invalid app snapshot permit.')
    }
    current.permit = undefined
    if (performance.now() >= permit.expires) throw new Error('App snapshot permit expired.')
    return current.capture.capture(permit.request)
  })
  ipcMain.handle(IPC_HANDLER_KEYS.APP_SNAPSHOT_CANCEL, (event, id: unknown) => {
    const current = authorized(event)
    if (current.permit?.request === id) current.permit = undefined
    current.capture.cancel(id)
  })

  return {
    revokeAuth: () => {
      authEpoch += 1
      if (tracked) tracked.permit = undefined
    },
    watch(window: BrowserWindow, shellURL: string): void {
      const shell = documentURL(shellURL)
      const wc = window.webContents
      let generation = 0
      const invalidate = (): void => {
        generation += 1
        revokePermit(window)
      }
      window.on('hide', invalidate)
      window.on('minimize', invalidate)
      window.on('resize', invalidate)
      window.on('move', invalidate)
      window.on('blur', invalidate)
      wc.on('frame-created', invalidate)
      wc.on('did-start-navigation', invalidate)
      wc.on('did-frame-navigate', invalidate)
      wc.on('did-navigate-in-page', invalidate)
      wc.on('zoom-changed', invalidate)
      wc.on('render-process-gone', invalidate)
      window.on('closed', () => {
        if (tracked?.window === window) tracked = undefined
      })
      const capture = createSnapshotCapture({
        inspect: () => {
          if (
            tracked?.window !== window ||
            window.isDestroyed() ||
            wc.isDestroyed() ||
            !window.isVisible() ||
            window.isMinimized() ||
            !window.isFocused() ||
            documentURL(wc.getURL()) !== shell
          )
            throw new Error('The app window is not visible.')
          const { baseUrl, token } = store.read()
          if (!baseUrl || !token) throw new Error('Sign in before capturing the app.')
          const { width, height } = window.getContentBounds()
          return {
            generation,
            auth: String(authEpoch),
            view: {
              width,
              height,
              zoom: wc.getZoomFactor(),
              scale: screen.getDisplayMatching(window.getBounds()).scaleFactor,
            },
          }
        },
        measure: async (id) => {
          // The isolated shell measures only its sole direct browsing context.
          // Require the sole native child to stay identical across that read;
          // never use a sibling's committed URL to authorize the measured box.
          const before = onlyChild(wc.mainFrame)
          if (!before) return null
          const result: Surface | null = await wc.executeJavaScriptInIsolatedWorld(1001, [
            { code: `(${measureSurface.toString()})(${JSON.stringify(id)})` },
          ])
          const after = onlyChild(wc.mainFrame)
          const { baseUrl } = store.read()
          if (
            !result ||
            !baseUrl ||
            !isGrantedApp(result.src, baseUrl, shell, result.projectId) ||
            !after ||
            before.frame !== after.frame ||
            before.url !== after.url ||
            before.origin !== after.origin ||
            after.url !== documentURL(result.src) ||
            after.origin !== new URL(result.src).origin
          )
            return null
          // Include the native identity in the pre/post sample comparison.
          return { ...result, frame: after.frame }
        },
        sample: async (rect) => {
          const image = await wc.capturePage(rect)
          return image.toPNG({
            scaleFactor: screen.getDisplayMatching(window.getBounds()).scaleFactor,
          })
        },
      })
      tracked = { window, shell, capture }
    },
  }
}
