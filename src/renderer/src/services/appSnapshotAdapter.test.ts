import { ScreenshotAnnotationDraft } from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppSnapshotAdapter } from './appSnapshotAdapter'

const chat = { type: 'PROJECT_TOPIC', projectId: 'p', topicId: 'first' } as ChatContext
const snapshot = {
  png: Uint8Array.of(1, 2),
  image: { width: 100, height: 50 },
  appViewport: { width: 100, height: 50 },
}

// Let the fixture preserve Vitest's inferred mock signatures.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fixture() {
  const surface = document.createElement('div')
  document.body.append(surface)
  const service = { capture: vi.fn(async () => snapshot), cancel: vi.fn(async () => {}) }
  const adapter = createAppSnapshotAdapter(service, () => surface)
  const draft = new ScreenshotAnnotationDraft()
  const kept = '.factory/attachments/app-snapshot.png'
  const upload = vi.fn(async () => kept)
  const onNote = vi.fn()
  const open = (): void =>
    draft.requestCapture(
      { context: chat, projectId: 'p', route: null },
      adapter,
      upload,
      onNote,
      () => [],
    )
  return { surface, service, draft, upload, onNote, open, kept }
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('chat app screenshot draft', () => {
  it('captures only when requested and uploads only to the launching chat on confirmation', async () => {
    const f = fixture()
    expect(f.service.capture).not.toHaveBeenCalled()
    f.open()
    expect(f.surface.hasAttribute('data-snapshot-request')).toBe(true)
    await vi.waitFor(() => expect(f.draft.getSnapshot().phase).toBe('preview'))
    expect(f.surface.hasAttribute('data-snapshot-request')).toBe(false)
    expect(f.upload).not.toHaveBeenCalled()
    f.draft.setComment('Unsaved state')
    f.draft.confirm()
    await vi.waitFor(() => expect(f.onNote).toHaveBeenCalledOnce())
    expect(f.upload).toHaveBeenCalledExactlyOnceWith(
      chat,
      expect.objectContaining({ size: 2, blob: expect.any(Blob) }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(f.onNote.mock.calls[0]?.[0]).toMatchObject({
      comment: 'Unsaved state',
      targets: [{ kind: 'area' }],
    })
    expect(JSON.stringify(f.onNote.mock.calls[0]?.[0])).toContain(f.kept)
    expect(f.draft.getPreviewFile()).toBeNull()
  })

  it('discards late pixels when the owning composer closes or switches', async () => {
    const f = fixture()
    let finish!: (result: typeof snapshot) => void
    f.service.capture.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    f.open()
    const id = f.surface.getAttribute('data-snapshot-request')
    f.draft.dispose()
    expect(f.service.cancel).toHaveBeenCalledExactlyOnceWith(id)
    expect(f.surface.hasAttribute('data-snapshot-request')).toBe(false)
    finish(snapshot)
    await Promise.resolve()
    expect(f.draft.getPreviewFile()).toBeNull()
    expect(f.upload).not.toHaveBeenCalled()
    expect(f.onNote).not.toHaveBeenCalled()
  })

  it('uploads only the preview crop and releases the decode and canvas buffers', async () => {
    const f = fixture()
    const close = vi.fn()
    const drawImage = vi.fn()
    const bitmap = { close }
    const cropped = new Blob(['cropped'], { type: 'image/png' })
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    const canvases: HTMLCanvasElement[] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
    ): void {
      canvases.push(this)
      callback(cropped)
    })
    f.open()
    await vi.waitFor(() => expect(f.draft.getSnapshot().phase).toBe('preview'))
    f.draft.applyCrop(
      { x: 5, y: 4, width: 20, height: 10 },
      {
        space: 'preview',
        iframeOffset: { x: 0, y: 0 },
        scroll: { x: 0, y: 0 },
        hostZoom: 1,
        scaleX: 2,
        scaleY: 2,
        image: snapshot.image,
      },
    )
    f.draft.setComment('Only this region')
    f.draft.confirm()
    await vi.waitFor(() => expect(f.onNote).toHaveBeenCalledOnce())
    expect(drawImage).toHaveBeenCalledExactlyOnceWith(bitmap, 10, 8, 40, 20, 0, 0, 40, 20)
    expect(f.upload.mock.calls[0]).toEqual([
      chat,
      expect.objectContaining({ blob: cropped }),
      expect.anything(),
    ])
    expect(close).toHaveBeenCalledOnce()
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 })
  })

  it('aborts an in-flight upload and discards its late kept path when the owner closes', async () => {
    const f = fixture()
    let finish!: (path: string) => void
    f.upload.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    f.open()
    await vi.waitFor(() => expect(f.draft.getSnapshot().phase).toBe('preview'))
    f.draft.setComment('Do not deliver')
    f.draft.confirm()
    expect(f.upload).toHaveBeenCalledOnce()
    f.draft.dispose()
    expect(f.upload.mock.calls[0]).toEqual([
      chat,
      expect.anything(),
      { signal: expect.objectContaining({ aborted: true }) },
    ])
    finish(f.kept)
    await Promise.resolve()
    expect(f.onNote).not.toHaveBeenCalled()
    expect(f.draft.getPreviewFile()).toBeNull()
  })

  it('clears the request capability after a compositor error', async () => {
    const f = fixture()
    f.service.capture.mockRejectedValueOnce(new Error('Window resized'))
    f.open()
    await vi.waitFor(() => expect(f.draft.getSnapshot().error).toBe('Window resized'))
    expect(f.surface.hasAttribute('data-snapshot-request')).toBe(false)
    expect(f.upload).not.toHaveBeenCalled()
    f.open()
    await vi.waitFor(() => expect(f.draft.getSnapshot().phase).toBe('preview'))
  })
})
