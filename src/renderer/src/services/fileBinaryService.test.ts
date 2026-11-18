import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchFileBinaryUrl, revokeFileBinaryUrl } from './fileBinaryService'

const fetchMock = vi.fn()
const createObjectURL = vi.fn(() => 'blob:preview')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('URL', class extends URL {})
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('Files pane binary transport', () => {
  it.each(['clips/demo.mp4', 'clips/demo.webm', 'clips/DEMO.MOV'])(
    'requests a signed streaming URL for %s without downloading the video',
    async (path) => {
      const url = '/api/v1/projects/p%20one/files/raw?path=clip.mp4&mediaToken=scoped'
      const blob = vi.fn()
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ url }), blob })

      await expect(
        fetchFileBinaryUrl('https://backend.test///', 'p one', path, 'test-bearer'),
      ).resolves.toBe(`https://backend.test${url}`)
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        'https://backend.test/api/v1/projects/p%20one/files/media-url',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-bearer',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path }),
        },
      )
      expect(blob).not.toHaveBeenCalled()
      expect(createObjectURL).not.toHaveBeenCalled()
    },
  )

  it('preserves an absolute signed URL and never adds the bearer to it', async () => {
    const url = 'https://backend.test/api/v1/projects/p/files/raw?mediaToken=scoped'
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ url }) })
    await expect(
      fetchFileBinaryUrl('https://backend.test', 'p', 'clip.mp4', 'test-bearer'),
    ).resolves.toBe(url)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([401, 403, 404, 500])(
    'surfaces grant failure %s without a raw fallback',
    async (status) => {
      fetchMock.mockResolvedValue({ ok: false, status })
      await expect(
        fetchFileBinaryUrl('https://backend.test', 'p', 'clip.mp4', null),
      ).rejects.toThrow(`Failed to load video (${status})`)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(createObjectURL).not.toHaveBeenCalled()
    },
  )

  it.each(['picture.png', 'document.pdf'])(
    'keeps authenticated blob loading for %s',
    async (path) => {
      const blob = new Blob(['preview'])
      fetchMock.mockResolvedValue({ ok: true, blob: async () => blob })
      createObjectURL.mockReturnValue('blob:preview')
      await expect(
        fetchFileBinaryUrl('https://backend.test/', 'p', path, 'test-bearer'),
      ).resolves.toBe('blob:preview')
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        `https://backend.test/api/v1/projects/p/files/raw?path=${encodeURIComponent(path)}`,
        { headers: { Authorization: 'Bearer test-bearer' } },
      )
      expect(createObjectURL).toHaveBeenCalledWith(blob)
    },
  )

  it('surfaces a raw file load failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 })
    await expect(
      fetchFileBinaryUrl('https://backend.test', 'p', 'picture.png', null),
    ).rejects.toThrow('Failed to load file (404)')
  })

  it('revokes only object URLs, leaving signed streaming URLs alone', () => {
    revokeFileBinaryUrl('https://backend.test/files/raw?mediaToken=scoped')
    revokeFileBinaryUrl('data:image/png;base64,AA==')
    expect(revokeObjectURL).not.toHaveBeenCalled()
    revokeFileBinaryUrl('blob:preview')
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:preview')
  })
})
