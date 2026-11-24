// @vitest-environment node
import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import keys from '../preload/ipcHandlersKeys'
import { registerAppSnapshotIpc } from './registerAppSnapshotIpc'

const { handlers, gate } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  gate: { enabled: undefined as boolean | undefined },
}))
vi.mock('../preload/appSnapshotAvailability', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../preload/appSnapshotAvailability')>()
  return {
    get APP_SNAPSHOT_ENABLED() {
      return gate.enabled ?? actual.APP_SNAPSHOT_ENABLED
    },
  }
})
vi.mock('electron', () => ({
  ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
  screen: { getDisplayMatching: () => ({ scaleFactor: 1 }) },
}))
const shell = 'file:///overseer/index.html'
const src = 'https://fixture.test/api/v1/projects/p/view/index.html?viewToken=granted'
const id = '00000000-0000-4000-8000-000000000000'
const appFrame = {
  url: src,
  origin: new URL(src).origin,
  detached: false,
  frameTreeNodeId: 2,
  processId: 3,
  frameToken: 'app-frame',
}

// Let the fixture preserve Vitest's inferred mock signatures.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fixture() {
  const image = Buffer.alloc(24)
  image.write('89504e470d0a1a0a', 0, 'hex')
  image.write('IHDR', 12)
  image.writeUInt32BE(100, 16)
  image.writeUInt32BE(120, 20)
  const wc = Object.assign(new EventEmitter(), {
    mainFrame: { url: `${shell}#/chat`, frames: [{ ...appFrame }] },
    isDestroyed: vi.fn(() => false),
    getURL: () => `${shell}#/chat`,
    getZoomFactor: () => 1,
    executeJavaScriptInIsolatedWorld: vi.fn(async () => ({
      src,
      projectId: 'p',
      dpr: 1,
      left: 12,
      top: 24,
      right: 112,
      bottom: 144,
    })),
    capturePage: vi.fn(async () => ({ toPNG: () => image })),
  })
  const win = Object.assign(new EventEmitter(), {
    webContents: wc,
    isDestroyed: vi.fn(() => false),
    isVisible: vi.fn(() => true),
    isFocused: vi.fn(() => true),
    isMinimized: vi.fn(() => false),
    getContentBounds: () => ({ width: 300, height: 300 }),
    getBounds: () => ({}),
  })
  const read = vi.fn(() => ({ baseUrl: 'https://fixture.test', token: 'test' as string | null }))
  const ipc = registerAppSnapshotIpc({ read, clear: vi.fn(), write: vi.fn() })!
  ipc.watch(win as unknown as BrowserWindow, shell)
  const event = { sender: wc, senderFrame: wc.mainFrame }
  const capture = (...args: unknown[]): unknown => handlers.get(keys.APP_SNAPSHOT)!(...args)
  const authorize = (...args: unknown[]): unknown =>
    handlers.get(keys.APP_SNAPSHOT_AUTHORIZE)!(...args)
  const captureFromPreload = (): unknown => capture(event, id, authorize(event, id))
  return { wc, win, read, event, capture, authorize, captureFromPreload, ipc }
}

beforeEach(() => {
  gate.enabled = undefined
  handlers.clear()
})

describe('app snapshot IPC', () => {
  it('registers no snapshot channels when the release switch is off', () => {
    gate.enabled = false
    const store = { read: vi.fn(), clear: vi.fn(), write: vi.fn() }
    expect(registerAppSnapshotIpc(store)).toBeUndefined()
    expect(handlers.size).toBe(0)
    expect(store.read).not.toHaveBeenCalled()
  })

  it('registers only the three snapshot channels by default', () => {
    const store = { read: vi.fn(), clear: vi.fn(), write: vi.fn() }
    expect(registerAppSnapshotIpc(store)).toBeDefined()
    expect(new Set(handlers.keys())).toEqual(
      new Set([keys.APP_SNAPSHOT_AUTHORIZE, keys.APP_SNAPSHOT, keys.APP_SNAPSHOT_CANCEL]),
    )
  })

  it('accepts only the tracked shell main frame and a matching one-shot permit', async () => {
    const { wc, event, capture, authorize, captureFromPreload } = fixture()
    const subframe = { ...event, senderFrame: wc.mainFrame.frames[0] }
    expect(() => capture(subframe, id)).toThrow('shell')
    expect(() => authorize(subframe, id)).toThrow('shell')
    expect(() => capture(event, id)).toThrow('permit')
    expect(() => capture({ ...event, sender: {} }, id)).toThrow('shell')
    expect(() => capture(event, id, { path: '/tmp/capture.png' })).toThrow('Invalid')
    wc.mainFrame.url = 'file:///different/index.html'
    expect(() => capture(event, id)).toThrow('shell')
    expect(wc.capturePage).not.toHaveBeenCalled()
    wc.mainFrame.url = shell
    const permit = authorize(event, id)
    expect(() => capture(event, id, 'wrong')).toThrow('permit')
    expect(() => capture(event, id.replace(/0$/, '1'), permit)).toThrow('permit')
    await expect(capture(event, id, permit)).resolves.toMatchObject({
      image: { width: 100, height: 120 },
    })
    expect(() => capture(event, id, permit)).toThrow('permit')
    await expect(captureFromPreload()).rejects.toThrow('already used')
    expect(wc.capturePage).toHaveBeenCalledExactlyOnceWith({
      x: 12,
      y: 24,
      width: 100,
      height: 120,
    })
  })

  it.each(['timeout', 'navigation', 'auth', 'cancel'])('revokes unspent permits on %s', (cause) => {
    const { wc, ipc, event, capture, authorize } = fixture()
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout'] })
    try {
      const permit = authorize(event, id)
      if (cause === 'timeout') vi.advanceTimersByTime(1001)
      if (cause === 'navigation') wc.emit('did-start-navigation')
      if (cause === 'auth') ipc.revokeAuth()
      if (cause === 'cancel') handlers.get(keys.APP_SNAPSHOT_CANCEL)!(event, id)
      expect(() => capture(event, id, permit)).toThrow(/permit/i)
      expect(wc.capturePage).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('discards a sample when navigation commits during capture even with unchanged geometry', async () => {
    const { wc, captureFromPreload } = fixture()
    const sample = wc.capturePage.getMockImplementation()!
    wc.capturePage.mockImplementationOnce(async () => {
      wc.emit('did-frame-navigate')
      return sample()
    })
    await expect(captureFromPreload()).rejects.toThrow('changed')
    expect(wc.capturePage).toHaveBeenCalledOnce()
  })

  it('refuses ambiguous direct children even if one has the granted URL', async () => {
    const { wc, captureFromPreload } = fixture()
    wc.mainFrame.frames[0].url = 'https://redirect.test/'
    wc.mainFrame.frames.push({ ...appFrame, frameTreeNodeId: 5, frameToken: 'sibling' })
    await expect(captureFromPreload()).rejects.toThrow('fully visible')
    expect(wc.capturePage).not.toHaveBeenCalled()
  })

  it('refuses a frame replacement across the geometry measurement', async () => {
    const { wc, captureFromPreload } = fixture()
    const measure = wc.executeJavaScriptInIsolatedWorld.getMockImplementation()!
    wc.executeJavaScriptInIsolatedWorld.mockImplementationOnce(async () => {
      wc.mainFrame.frames = [{ ...appFrame, frameTreeNodeId: 5, frameToken: 'replacement' }]
      return measure()
    })
    await expect(captureFromPreload()).rejects.toThrow('fully visible')
    expect(wc.capturePage).not.toHaveBeenCalled()
  })

  it.each([
    ['replacement child', { frameTreeNodeId: 5, frameToken: 'replacement' }],
    ['replacement renderer frame', { processId: 7, frameToken: 'new-document' }],
  ])('discards a sample after a %s with the same URL and bounds', async (_label, change) => {
    const { wc, captureFromPreload } = fixture()
    const sample = wc.capturePage.getMockImplementation()!
    wc.capturePage.mockImplementationOnce(async () => {
      wc.mainFrame.frames = [{ ...appFrame, ...change }]
      return sample()
    })
    await expect(captureFromPreload()).rejects.toThrow('changed')
    expect(wc.capturePage).toHaveBeenCalledOnce()
  })

  it('discards a sample when a frame was created during capture', async () => {
    const { wc, captureFromPreload } = fixture()
    const sample = wc.capturePage.getMockImplementation()!
    wc.capturePage.mockImplementationOnce(async () => {
      wc.emit('frame-created')
      return sample()
    })
    await expect(captureFromPreload()).rejects.toThrow('changed')
  })

  it('requires the committed origin as well as the expected URL', async () => {
    const { wc, captureFromPreload } = fixture()
    wc.mainFrame.frames[0].origin = 'null'
    await expect(captureFromPreload()).rejects.toThrow('fully visible')
    expect(wc.capturePage).not.toHaveBeenCalled()
  })

  it('requires a visible authorized chat surface with a committed app document', async () => {
    const { wc, win, read, captureFromPreload } = fixture()
    win.isVisible.mockReturnValueOnce(false)
    await expect(captureFromPreload()).rejects.toThrow('visible')
    win.isMinimized.mockReturnValueOnce(true)
    await expect(captureFromPreload()).rejects.toThrow('visible')
    read.mockReturnValueOnce({ baseUrl: 'https://fixture.test', token: null })
    await expect(captureFromPreload()).rejects.toThrow('Sign in')
    wc.mainFrame.frames[0].url = 'https://redirect.test/'
    await expect(captureFromPreload()).rejects.toThrow('fully visible')
    expect(wc.capturePage).not.toHaveBeenCalled()
  })
})
