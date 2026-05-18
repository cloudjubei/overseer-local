/**
 * Decide whether a `File` should be uploaded as text or base64-encoded
 * binary. The backend's `/files/upload` route accepts exactly one of
 * `content` or `contentBase64`, so callers need to pick before sending.
 *
 * Heuristic, in order:
 * 1. If `file.type` is empty → fall back to extension table.
 * 2. Treat `text/*`, `application/json`, `application/xml`, `+json`, `+xml`,
 *    and the common script / config types as text.
 * 3. Everything else (images, archives, binaries) → base64.
 *
 * Returning `'text'` for an unknown type would risk corrupting binary data
 * (UTF-8 round-trips lose high bytes); returning `'binary'` is always safe.
 */

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'jsonc',
  'yaml',
  'yml',
  'toml',
  'ini',
  'conf',
  'env',
  'csv',
  'tsv',
  'xml',
  'svg',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'h',
  'cc',
  'cpp',
  'hpp',
  'cs',
  'php',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'sql',
  'graphql',
  'gql',
  'lock',
  'gitignore',
  'gitattributes',
  'editorconfig',
  'log',
])

const TEXT_MIME_PREFIXES = ['text/']
const TEXT_MIME_EXACT = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/x-typescript',
  'application/x-yaml',
  'application/x-sh',
  'application/x-shellscript',
  'application/sql',
  'image/svg+xml',
])

export type UploadEncoding = 'text' | 'binary'

export function detectUploadEncoding(file: { name: string; type: string }): UploadEncoding {
  const mime = (file.type || '').toLowerCase()
  if (mime) {
    if (TEXT_MIME_PREFIXES.some((p) => mime.startsWith(p))) return 'text'
    if (TEXT_MIME_EXACT.has(mime)) return 'text'
    if (mime.endsWith('+json') || mime.endsWith('+xml')) return 'text'
    return 'binary'
  }
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  return ext && TEXT_EXTENSIONS.has(ext) ? 'text' : 'binary'
}

/**
 * Convert an `ArrayBuffer` to a base64 string. Implementation goes via
 * `btoa(String.fromCharCode(...chunk))` so it doesn't blow the call stack
 * on large files (~64 KiB chunks). Browser-only — runs on the upload path
 * which is also browser-only.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK)
    binary += String.fromCharCode.apply(null, slice as unknown as number[])
  }
  return btoa(binary)
}
