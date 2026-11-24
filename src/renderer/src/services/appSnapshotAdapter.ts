import type { ScreenshotCaptureAdapter } from 'thefactory-ui/headless'
import type { AppSnapshotService } from '../../../preload/appSnapshotTypes'

const pngFile = (blob: Blob): { name: string; size: number; blob: Blob } => ({
  name: 'app-snapshot.png',
  size: blob.size,
  blob,
})

export function createAppSnapshotAdapter(
  service: AppSnapshotService,
  surface: () => HTMLElement | null,
): ScreenshotCaptureAdapter {
  return {
    async capture({ signal }) {
      signal.throwIfAborted()
      const host = surface()
      if (!host || host.hasAttribute('data-snapshot-request')) {
        throw new Error('The chat app is not ready to capture.')
      }
      const id = crypto.randomUUID()
      const abort = (): void => {
        host.removeAttribute('data-snapshot-request')
        void service.cancel(id).catch(() => {})
      }
      host.setAttribute('data-snapshot-request', id)
      signal.addEventListener('abort', abort, { once: true })
      try {
        const { png, image, appViewport } = await service.capture(id)
        signal.throwIfAborted()
        if (surface() !== host || !host.isConnected) throw new Error('The chat app changed.')
        return {
          file: pngFile(new Blob([png], { type: 'image/png' })),
          image,
          appViewport,
          source: 'app',
        }
      } finally {
        signal.removeEventListener('abort', abort)
        if (host.getAttribute('data-snapshot-request') === id)
          host.removeAttribute('data-snapshot-request')
      }
    },
    // Blob lifetime belongs to the shared draft and preview. No disk file or URL is created here.
    release: () => {},
    async crop(pixels, rect) {
      if (!('blob' in pixels.file)) throw new Error('No snapshot to crop.')
      const bitmap = await createImageBitmap(pixels.file.blob)
      const canvas = document.createElement('canvas')
      try {
        canvas.width = rect.width
        canvas.height = rect.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Image cropping is unavailable.')
        ctx.drawImage(
          bitmap,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          0,
          0,
          rect.width,
          rect.height,
        )
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (image) => (image ? resolve(image) : reject(new Error('Could not crop the snapshot.'))),
            'image/png',
          )
        })
        return { ...pixels, file: pngFile(blob), image: { width: rect.width, height: rect.height } }
      } finally {
        bitmap.close()
        canvas.width = canvas.height = 0
      }
    },
  }
}
