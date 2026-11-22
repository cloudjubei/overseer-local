import { describe, expect, it, vi } from 'vitest'
import IPC_HANDLER_KEYS from '../preload/ipcHandlersKeys'
import { DEEP_LINK_PROTOCOL } from './deepLinkConstants'
import { registerDeepLinks } from './registerDeepLinks'
import type { DeepLinkEnvironment, DeepLinkRegistration } from './deepLinkTypes'

const STORY = 'overseer://projects/p1/stories/s1'
const RUN = 'overseer://projects/p1/process-runs/r1'
const PACKAGED_EXEC = '/Applications/Overseer.app/Contents/MacOS/Overseer'

type Listener = (...args: unknown[]) => void

class FakeEmitter {
  readonly listeners = new Map<string, Listener[]>()

  on<L extends (...args: never[]) => void>(event: string, listener: L): this {
    this.listeners.set(event, [
      ...(this.listeners.get(event) ?? []),
      listener as unknown as Listener,
    ])
    return this
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args)
  }
}

class FakeApp extends FakeEmitter {
  ready = false
  readonly requestSingleInstanceLock = vi.fn(() => this.lock)
  readonly quit = vi.fn()
  readonly setAsDefaultProtocolClient = vi.fn(() => true)

  constructor(private readonly lock = true) {
    super()
  }

  isReady(): boolean {
    return this.ready
  }

  openUrl(url: string): { preventDefault: ReturnType<typeof vi.fn> } {
    const event = { preventDefault: vi.fn() }
    this.emit('open-url', event, url)
    return event
  }

  secondInstance(argv: string[]): void {
    this.emit('second-instance', {}, argv)
  }
}

class FakeIpcMain extends FakeEmitter {
  listen(listening: unknown): void {
    this.emit(IPC_HANDLER_KEYS.DEEP_LINK_LISTENING, {}, listening)
  }
}

class FakeWebContents extends FakeEmitter {
  readonly send = vi.fn()
}

class FakeWindow extends FakeEmitter {
  readonly webContents = new FakeWebContents()
  minimized = false
  destroyed = false
  readonly restore = vi.fn(() => {
    this.minimized = false
  })
  readonly show = vi.fn()
  readonly focus = vi.fn()

  isMinimized(): boolean {
    return this.minimized
  }

  isDestroyed(): boolean {
    return this.destroyed
  }
}

const packaged = (argv: string[] = [PACKAGED_EXEC]): DeepLinkEnvironment => ({
  argv,
  defaultApp: false,
  execPath: PACKAGED_EXEC,
  resolvePath: (path) => path,
})

type Setup = {
  app: FakeApp
  ipcMain: FakeIpcMain
  openWindow: ReturnType<typeof vi.fn>
  registration: DeepLinkRegistration | undefined
  window: () => FakeWindow | null
  sent: () => unknown[][]
}

function setup(
  opts: { lock?: boolean; environment?: DeepLinkEnvironment; window?: boolean } = {},
): Setup {
  const app = new FakeApp(opts.lock ?? true)
  const ipcMain = new FakeIpcMain()
  let window: FakeWindow | null = opts.window === false ? null : new FakeWindow()
  const openWindow = vi.fn(() => {
    window = new FakeWindow()
    registration?.watchWindow(window)
  })
  const registration = registerDeepLinks({
    app,
    ipcMain,
    environment: opts.environment ?? packaged(),
    getWindow: () => window,
    openWindow,
  })
  if (window) registration?.watchWindow(window)
  return {
    app,
    ipcMain,
    openWindow,
    registration,
    window: () => window,
    sent: () => window?.webContents.send.mock.calls ?? [],
  }
}

describe('registerDeepLinks', () => {
  it('hands a second launch over to the first: quits and registers nothing', () => {
    const { app, ipcMain, registration } = setup({ lock: false })
    expect(app.quit).toHaveBeenCalledTimes(1)
    expect(registration).toBeUndefined()
    expect(app.setAsDefaultProtocolClient).not.toHaveBeenCalled()
    expect(app.listeners.size).toBe(0)
    expect(ipcMain.listeners.size).toBe(0)
  })

  it('registers the packaged app as the handler of the scheme', () => {
    const { app } = setup()
    expect(app.quit).not.toHaveBeenCalled()
    expect(app.setAsDefaultProtocolClient).toHaveBeenCalledExactlyOnceWith(DEEP_LINK_PROTOCOL)
  })

  it('registers a development run with the Electron binary and its app folder', () => {
    const electron = '/repo/node_modules/electron/dist/electron'
    const { app } = setup({
      environment: {
        argv: [electron, '.'],
        defaultApp: true,
        execPath: electron,
        resolvePath: (path) => (path === '.' ? '/repo' : path),
      },
    })
    expect(app.setAsDefaultProtocolClient).toHaveBeenCalledExactlyOnceWith(
      DEEP_LINK_PROTOCOL,
      electron,
      ['/repo'],
    )
  })

  it('holds a macOS link that opens the app until the page listens', () => {
    const { app, ipcMain, sent } = setup()
    const event = app.openUrl(STORY)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(sent()).toEqual([])
    ipcMain.listen(true)
    expect(sent()).toEqual([[IPC_HANDLER_KEYS.DEEP_LINK_OPEN, STORY]])
  })

  it('holds a link a Windows or Linux cold start carries in its arguments', () => {
    const { ipcMain, sent } = setup({ environment: packaged([PACKAGED_EXEC, STORY]) })
    expect(sent()).toEqual([])
    ipcMain.listen(true)
    expect(sent()).toEqual([[IPC_HANDLER_KEYS.DEEP_LINK_OPEN, STORY]])
  })

  it('opens a link of a second launch in the running window and brings it forward', () => {
    const { app, ipcMain, window, sent } = setup()
    ipcMain.listen(true)
    window()!.minimized = true
    app.secondInstance(['C:\\Overseer\\Overseer.exe', RUN, '--allow-file-access-from-files'])
    expect(window()!.restore).toHaveBeenCalled()
    expect(window()!.show).toHaveBeenCalled()
    expect(window()!.focus).toHaveBeenCalled()
    expect(sent()).toEqual([[IPC_HANDLER_KEYS.DEEP_LINK_OPEN, RUN]])
  })

  it('brings the window forward on a second launch without a link, sending nothing', () => {
    const { app, ipcMain, window, sent } = setup()
    ipcMain.listen(true)
    app.secondInstance(['C:\\Overseer\\Overseer.exe'])
    expect(window()!.restore).not.toHaveBeenCalled()
    expect(window()!.focus).toHaveBeenCalled()
    expect(sent()).toEqual([])
  })

  it('opens a window for a link that arrives while the app runs with none', () => {
    const { app, ipcMain, openWindow, sent } = setup({ window: false })
    app.ready = true
    app.openUrl(STORY)
    expect(openWindow).toHaveBeenCalledTimes(1)
    expect(sent()).toEqual([])
    ipcMain.listen(true)
    expect(sent()).toEqual([[IPC_HANDLER_KEYS.DEEP_LINK_OPEN, STORY]])
  })

  it('leaves the first window to start-up when a link arrives before the app is ready', () => {
    const { app, openWindow } = setup({ window: false })
    app.openUrl(STORY)
    expect(openWindow).not.toHaveBeenCalled()
  })

  it.each(['did-navigate', 'render-process-gone'])(
    'holds links again after the page goes away (%s) until the new page listens',
    (event) => {
      const { app, ipcMain, window, sent } = setup()
      ipcMain.listen(true)
      window()!.webContents.emit(event)
      app.openUrl(RUN)
      expect(sent()).toEqual([])
      ipcMain.listen(true)
      expect(sent()).toEqual([[IPC_HANDLER_KEYS.DEEP_LINK_OPEN, RUN]])
    },
  )

  it('holds a link after the window closes until the next window listens', () => {
    const { app, ipcMain, window, openWindow, sent } = setup()
    ipcMain.listen(true)
    const first = window()!
    first.emit('closed')
    openWindow()
    app.secondInstance([PACKAGED_EXEC, STORY])
    expect(first.webContents.send).not.toHaveBeenCalled()
    expect(sent()).toEqual([])
    ipcMain.listen(true)
    expect(sent()).toEqual([[IPC_HANDLER_KEYS.DEEP_LINK_OPEN, STORY]])
  })

  it('sends nothing to a window that is already destroyed', () => {
    const { app, ipcMain, window, openWindow } = setup()
    app.ready = true
    ipcMain.listen(true)
    window()!.destroyed = true
    const gone = window()!
    app.secondInstance([PACKAGED_EXEC, STORY])
    expect(gone.webContents.send).not.toHaveBeenCalled()
    expect(gone.focus).not.toHaveBeenCalled()
    expect(openWindow).toHaveBeenCalledTimes(1)
  })

  it('stops handing links over when the page says it stopped listening', () => {
    const { app, ipcMain, sent } = setup()
    ipcMain.listen(true)
    ipcMain.listen(false)
    app.openUrl(STORY)
    expect(sent()).toEqual([])
  })

  it('treats anything but a plain true from the page as not listening', () => {
    const { app, ipcMain, sent } = setup()
    ipcMain.listen('true')
    app.openUrl(STORY)
    expect(sent()).toEqual([])
  })

  it('ignores a URL of another scheme, still bringing the window forward', () => {
    const { app, ipcMain, window, sent } = setup()
    ipcMain.listen(true)
    app.openUrl('https://example.com/')
    expect(window()!.focus).toHaveBeenCalled()
    expect(sent()).toEqual([])
  })
})
