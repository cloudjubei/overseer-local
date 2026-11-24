import type { Rectangle } from 'electron'
import type { AppSnapshot } from '../preload/appSnapshotTypes'

export const SNAPSHOT_MAX_BYTES = 8 * 1024 * 1024
const MAX_EDGE = 4096
const MAX_PIXELS = 8_000_000
const SNAPSHOT_TIMEOUT_MS = 3000

export type Surface = {
  left: number
  top: number
  right: number
  bottom: number
  dpr: number
  src: string
  projectId: string
}

type View = { width: number; height: number; zoom: number; scale: number }

const fits = (width: number, height: number): boolean =>
  Number.isSafeInteger(width) &&
  Number.isSafeInteger(height) &&
  width > 0 &&
  height > 0 &&
  width <= MAX_EDGE &&
  height <= MAX_EDGE &&
  width * height <= MAX_PIXELS

export function captureRect(surface: Surface, view: View): Rectangle {
  const { left, top, right, bottom, dpr } = surface
  const { zoom, scale, width, height } = view
  if (
    ![left, top, right, bottom, dpr, zoom, scale, width, height].every(Number.isFinite) ||
    zoom <= 0 ||
    scale <= 0 ||
    Math.abs(dpr - zoom * scale) > 0.02 ||
    left < 0 ||
    top < 0 ||
    right * zoom > width + 0.01 ||
    bottom * zoom > height + 0.01
  ) {
    throw new Error('The app is outside the visible window or its scale changed.')
  }
  // CSS coordinates → Electron content DIPs. Display scale applies to output,
  // not to the capturePage argument. Never round out into neighboring chrome.
  const x = Math.ceil(left * zoom)
  const y = Math.ceil(top * zoom)
  const w = Math.floor(right * zoom) - x
  const h = Math.floor(bottom * zoom) - y
  if (!fits(w, h) || !fits(Math.ceil(w * scale), Math.ceil(h * scale))) {
    throw new Error('The visible app is too small or too large to capture.')
  }
  return { x, y, width: w, height: h }
}

export function isGrantedApp(src: string, base: string, shell: string, projectId: string): boolean {
  try {
    const url = new URL(src)
    const expected = new URL(
      `${base.replace(/\/$/, '')}/api/v1/projects/${encodeURIComponent(projectId)}/view/index.html`,
    )
    return (
      !!projectId &&
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.origin !== new URL(shell).origin &&
      url.origin === expected.origin &&
      url.pathname === expected.pathname &&
      !!url.searchParams.get('viewToken')
    )
  } catch {
    return false
  }
}

export type SnapshotDependencies = {
  // This state comes from the tracked window and auth store, never IPC args.
  inspect: () => { view: View; generation: number; auth: string }
  measure: (requestId: string) => Promise<(Surface & { frame: string }) | null>
  sample: (rect: Rectangle) => Promise<Buffer>
}

export type SnapshotCapture = {
  cancel: (id: unknown) => void
  capture: (id: unknown) => Promise<AppSnapshot>
}

export function createSnapshotCapture({
  inspect,
  measure,
  sample,
}: SnapshotDependencies): SnapshotCapture {
  let active: { id: string; cancelled: boolean } | undefined
  // Bound replay bookkeeping to the life of this window. Reloading the app
  // window resets the capability; no old request is accepted in this window.
  const used = new Set<string>()
  return {
    cancel(id: unknown): void {
      if (active && active.id === id) active.cancelled = true
    },
    async capture(id: unknown): Promise<AppSnapshot> {
      if (
        typeof id !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(id) ||
        active ||
        used.has(id) ||
        used.size >= 4096
      ) {
        throw new Error('Invalid or already used app snapshot request.')
      }
      const start = inspect()
      const deadline = Date.now() + SNAPSHOT_TIMEOUT_MS
      const request = { id, cancelled: false }
      used.add(id)
      active = request
      const verify = (): void => {
        if (
          request.cancelled ||
          Date.now() > deadline ||
          JSON.stringify(inspect()) !== JSON.stringify(start)
        ) {
          throw new Error('The app snapshot was cancelled or the window changed.')
        }
      }
      // A hidden or unresponsive renderer can stop delivering animation frames.
      // Bound both measurements, but keep the window locked while native sampling
      // is in flight so a stalled capture cannot overlap a second compositor read.
      const measureBeforeDeadline = async (): ReturnType<SnapshotDependencies['measure']> => {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          return await Promise.race([
            measure(id),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error('The app did not become ready to capture.')),
                Math.max(0, deadline - Date.now()),
              )
            }),
          ])
        } finally {
          clearTimeout(timer)
        }
      }
      try {
        const surface = await measureBeforeDeadline()
        verify()
        if (!surface) throw new Error('The chat app must be fully visible to capture it.')
        const rect = captureRect(surface, start.view)
        const png = await sample(rect)
        verify()
        const after = await measureBeforeDeadline()
        verify()
        if (JSON.stringify(after) !== JSON.stringify(surface)) {
          throw new Error('The app changed during capture. Try again.')
        }
        if (
          png.length < 24 ||
          png.length >= SNAPSHOT_MAX_BYTES ||
          png.toString('hex', 0, 8) !== '89504e470d0a1a0a' ||
          png.toString('ascii', 12, 16) !== 'IHDR'
        ) {
          throw new Error('The snapshot was empty or exceeds the image size limit.')
        }
        const width = png.readUInt32BE(16)
        const height = png.readUInt32BE(20)
        // Electron can return a 1x representation or a display-scale bitmap.
        const matches = (scale: number): boolean =>
          Math.abs(width - rect.width * scale) < 1 && Math.abs(height - rect.height * scale) < 1
        if (!fits(width, height) || (!matches(1) && !matches(start.view.scale))) {
          throw new Error('The captured image did not match the visible app.')
        }
        return {
          png: Uint8Array.from(png),
          image: { width, height },
          appViewport: {
            width: surface.right - surface.left,
            height: surface.bottom - surface.top,
          },
        }
      } finally {
        active = undefined
      }
    },
  }
}
