import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSnapshotService } from './appSnapshotTypes'
import keys from './ipcHandlersKeys'

const { expose, invoke } = vi.hoisted(() => ({ expose: vi.fn(), invoke: vi.fn() }))
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: expose },
  ipcRenderer: { invoke },
}))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  invoke.mockResolvedValue('private-permit')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('./appSnapshotAvailability')
})

async function loadPreload(isMainFrame = true): Promise<AppSnapshotService | undefined> {
  vi.stubGlobal(
    'process',
    Object.assign(Object.create(process), {
      contextIsolated: true,
      isMainFrame,
    }),
  )
  await import('./index')
  return expose.mock.calls.find(([name]) => name === 'appSnapshot')?.[1]
}

describe('app snapshot preload', () => {
  it('does not expose or arm capture when the release switch is off', async () => {
    vi.doMock('./appSnapshotAvailability', () => ({ APP_SNAPSHOT_ENABLED: false }))
    const listen = vi.fn()
    vi.stubGlobal('window', { addEventListener: listen })
    expect(await loadPreload()).toBeUndefined()
    expect(expose.mock.calls.map(([name]) => name)).toEqual([
      'authService',
      'systemDictation',
      'deepLinks',
    ])
    expect(listen).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('exposes the named capture bridge by default in the shell but not in subframes', async () => {
    vi.stubGlobal('window', { addEventListener: vi.fn() })
    await loadPreload(false)
    expect(expose).not.toHaveBeenCalled()
    vi.resetModules()
    await loadPreload()
    expect(expose.mock.calls.map(([name]) => name)).toEqual([
      'authService',
      'systemDictation',
      'deepLinks',
      'appSnapshot',
    ])
  })

  it('requests and spends a permit only inside a trusted Capture click dispatch', async () => {
    const listen = vi.fn()
    vi.stubGlobal('window', { addEventListener: listen })
    vi.stubGlobal('navigator', { userActivation: { isActive: true } })
    const service = (await loadPreload())!
    const button = document.createElement('button')
    // jsdom has no modal top layer or trusted input. Supply the isolated-world
    // listener's observations here; real input remains an Electron proof item.
    vi.spyOn(button, 'closest').mockImplementation((selector) =>
      selector === 'button' || selector.includes('data-app-capture-ready') ? button : null,
    )
    const click = listen.mock.calls.find(([name]) => name === 'click')?.[1]
    await expect(service.capture('request')).rejects.toThrow('Press Capture')
    click({ target: button, isTrusted: false, eventPhase: Event.BUBBLING_PHASE })
    await expect(service.capture('request')).rejects.toThrow('Press Capture')
    click({ target: button, isTrusted: true, eventPhase: Event.NONE })
    await expect(service.capture('request')).rejects.toThrow('Press Capture')
    const other = document.createElement('button')
    vi.spyOn(other, 'closest').mockImplementation((selector) =>
      selector === 'button' ? other : null,
    )
    click({
      target: other,
      isTrusted: true,
      eventPhase: Event.BUBBLING_PHASE,
    })
    await expect(service.capture('request')).rejects.toThrow('Press Capture')
    expect(invoke).not.toHaveBeenCalled()
    click({ target: button, isTrusted: true, eventPhase: Event.BUBBLING_PHASE })
    const result = service.capture('request')
    await expect(service.capture('request')).rejects.toThrow('Press Capture')
    await result
    expect(invoke.mock.calls).toEqual([
      [keys.APP_SNAPSHOT_AUTHORIZE, 'request'],
      [keys.APP_SNAPSHOT, 'request', 'private-permit'],
    ])
  })
})
