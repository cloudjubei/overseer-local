import { describe, expect, it } from 'vitest'
import { arrayBufferToBase64, detectUploadEncoding } from './uploadEncoding'

describe('detectUploadEncoding', () => {
  it('returns text for text/* mime types', () => {
    expect(detectUploadEncoding({ name: 'a.txt', type: 'text/plain' })).toBe('text')
    expect(detectUploadEncoding({ name: 'a.html', type: 'text/html' })).toBe('text')
  })

  it('returns text for application/json and +json variants', () => {
    expect(detectUploadEncoding({ name: 'a.json', type: 'application/json' })).toBe('text')
    expect(detectUploadEncoding({ name: 'a.geo', type: 'application/geo+json' })).toBe('text')
  })

  it('returns text for SVG (image/svg+xml is structurally text)', () => {
    expect(detectUploadEncoding({ name: 'logo.svg', type: 'image/svg+xml' })).toBe('text')
  })

  it('returns binary for raster images and binary application types', () => {
    expect(detectUploadEncoding({ name: 'a.png', type: 'image/png' })).toBe('binary')
    expect(detectUploadEncoding({ name: 'a.zip', type: 'application/zip' })).toBe('binary')
    expect(detectUploadEncoding({ name: 'a.bin', type: 'application/octet-stream' })).toBe('binary')
  })

  it('falls back to extension when MIME is empty', () => {
    expect(detectUploadEncoding({ name: 'a.ts', type: '' })).toBe('text')
    expect(detectUploadEncoding({ name: 'Dockerfile', type: '' })).toBe('binary')
    expect(detectUploadEncoding({ name: '.gitignore', type: '' })).toBe('text')
  })

  it('treats unknown extensions as binary (safer default)', () => {
    expect(detectUploadEncoding({ name: 'a.xyz', type: '' })).toBe('binary')
  })
})

describe('arrayBufferToBase64', () => {
  it('encodes a small buffer', () => {
    const buf = new Uint8Array([72, 105]).buffer
    expect(arrayBufferToBase64(buf)).toBe('SGk=')
  })

  it('handles binary high-byte data without corruption', () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer
    expect(arrayBufferToBase64(buf)).toBe('/9j/4A==')
  })

  it('round-trips a 200KB-ish buffer (chunked path)', () => {
    const size = 200_000
    const arr = new Uint8Array(size)
    for (let i = 0; i < size; i++) arr[i] = i & 0xff
    const b64 = arrayBufferToBase64(arr.buffer)
    // Decode back and compare lengths + a sample byte
    const decoded = atob(b64)
    expect(decoded.length).toBe(size)
    expect(decoded.charCodeAt(12345)).toBe(12345 & 0xff)
  })
})
