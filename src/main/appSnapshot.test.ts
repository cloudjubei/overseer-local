// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { captureRect, createSnapshotCapture, isGrantedApp, SNAPSHOT_MAX_BYTES } from './appSnapshot'

const surface = {
  left: 31.25,
  top: 27.5,
  right: 271.75,
  bottom: 167.75,
  dpr: 2.5,
  src: 'https://backend.test/api/v1/projects/p/view/index.html?viewToken=test',
  projectId: 'p',
  frame: 'native-fixture-frame',
}
const view = { width: 500, height: 400, zoom: 1.25, scale: 2 }
const id = '00000000-0000-4000-8000-000000000000'
const nextId = '00000000-0000-4000-8000-000000000001'
const png = (width = 598, height = 348): Buffer<ArrayBuffer> => {
  const bytes = Buffer.alloc(24)
  bytes.write('89504e470d0a1a0a', 0, 'hex')
  bytes.write('IHDR', 12)
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

// Let the fixture preserve Vitest's inferred mock signatures.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fixture() {
  const state = { view: { ...view }, auth: '1', generation: 0 }
  const measure = vi.fn(async () => surface)
  const sample = vi.fn(async () => png())
  return {
    ...createSnapshotCapture({
      inspect: () => ({ ...state, view: { ...state.view } }),
      measure,
      sample,
    }),
    sample,
    measure,
    state,
  }
}

describe('app-only snapshot', () => {
  it('samples only on demand and rounds offset bounds inward at fractional zoom and 2x scale', async () => {
    const f = fixture()
    expect(f.sample).not.toHaveBeenCalled()
    const result = await f.capture(id)
    expect(f.sample).toHaveBeenCalledExactlyOnceWith({ x: 40, y: 35, width: 299, height: 174 })
    expect(result.image).toEqual({ width: 598, height: 348 })
    expect(result.appViewport).toEqual({ width: 240.5, height: 140.25 })
    expect(result.png).toEqual(Uint8Array.from(png()))
    await f.capture(nextId)
    await expect(f.capture(id)).rejects.toThrow('already used')
  })

  it('rejects rectangles outside the content area, invalid numbers and overlarge physical output', () => {
    for (const invalid of [
      { left: -1 },
      { bottom: 399 },
      { right: NaN },
      { dpr: 1 },
      { right: 5 },
    ]) {
      expect(() => captureRect({ ...surface, ...invalid }, view)).toThrow()
    }
    expect(() => captureRect({ ...surface, right: 3000 }, { ...view, width: 4000 })).toThrow()
  })

  it('never samples an invalid rectangle even when supplied by trusted measurement', async () => {
    const f = fixture()
    f.measure.mockResolvedValueOnce({ ...surface, right: Infinity })
    await expect(f.capture(id)).rejects.toThrow('outside')
    expect(f.sample).not.toHaveBeenCalled()
  })

  it('requires an authenticated backend app URL, not a shell or another project', () => {
    const granted = (url: string, shell = 'file:///shell/index.html'): boolean =>
      isGrantedApp(url, 'https://backend.test', shell, 'p')
    expect(granted(surface.src)).toBe(true)
    expect(granted(surface.src, 'https://backend.test/')).toBe(false)
    expect(granted(surface.src.replace('/p/', '/other/'))).toBe(false)
    expect(granted(surface.src.replace('backend.test', 'other.test'))).toBe(false)
    expect(granted(surface.src.split('?')[0])).toBe(false)
  })

  it.each(['cancel', 'navigation', 'zoom', 'auth', 'moved surface'])(
    'discards in-flight pixels after %s and permits retry',
    async (change) => {
      const f = fixture()
      let finish!: (bytes: ReturnType<typeof png>) => void
      f.sample.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      const capture = f.capture(id)
      await vi.waitFor(() => expect(f.sample).toHaveBeenCalledOnce())
      await expect(f.capture(nextId)).rejects.toThrow('already used')
      if (change === 'cancel') f.cancel(id)
      if (change === 'navigation') f.state.generation++
      if (change === 'zoom') f.state.view.zoom = 2
      if (change === 'auth') f.state.auth = '2'
      if (change === 'moved surface') f.measure.mockResolvedValueOnce({ ...surface, left: 30 })
      finish(png())
      await expect(capture).rejects.toThrow(/changed|cancelled/)
      f.state.view.zoom = view.zoom
      await expect(f.capture(nextId)).resolves.toHaveProperty('image')
    },
  )

  it('releases the capture slot if the renderer stops providing measurements', async () => {
    vi.useFakeTimers()
    try {
      const f = fixture()
      f.measure.mockImplementationOnce(() => new Promise(() => {}))
      const failed = expect(f.capture(id)).rejects.toThrow('did not become ready')
      await vi.advanceTimersByTimeAsync(3000)
      await failed
      expect(f.sample).not.toHaveBeenCalled()
      await expect(f.capture(nextId)).resolves.toHaveProperty('image')
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([png(599, 349), Buffer.alloc(SNAPSHOT_MAX_BYTES), Buffer.alloc(24)])(
    'rejects mismatched, too large, or invalid PNG output',
    async (bytes) => {
      const f = fixture()
      f.sample.mockResolvedValueOnce(bytes)
      await expect(f.capture(id)).rejects.toThrow()
    },
  )
})
