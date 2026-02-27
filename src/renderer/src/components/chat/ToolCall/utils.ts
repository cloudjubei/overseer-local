import { createTwoFilesPatch } from 'diff'

export function tryString(v: any): string | undefined {
  if (v == null) return undefined
  try {
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function extract(obj: any, keys: string[]): any | undefined {
  if (!obj) return undefined
  for (const k of keys) {
    const parts = k.split('.')
    let cur: any = obj
    let ok = true
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p]
      else {
        ok = false
        break
      }
    }
    if (ok) return cur
  }
  return undefined
}

export function toLines(value: any): string[] {
  if (value == null) return []
  let str: string
  if (typeof value === 'string') str = value
  else {
    try {
      str = JSON.stringify(value, null, 2)
    } catch {
      str = String(value)
    }
  }
  return str.split(/\r?\n/)
}

export function buildSimpleUnifiedDiff(
  path: string,
  beforeText?: string,
  afterText?: string,
): string | undefined {
  if (!path || typeof afterText !== 'string') return undefined
  const before = typeof beforeText === 'string' ? beforeText : ''
  if (before === afterText) return undefined

  // Use the 'diff' library to generate a proper unified diff
  // This handles context lines, hunk headers, and proper line counting automatically.
  // We pass empty strings for headers to keep it minimal if preferred,
  // or use the path for clarity.
  try {
    const patch = createTwoFilesPatch(path, path, before, afterText, '', '')
    return patch
  } catch (err) {
    console.error('Failed to generate diff', err)
    // Fallback or return undefined
    return undefined
  }
}

export function buildUnifiedDiffIfPresent(result: any): string | undefined {
  if (!result) return undefined
  const raw =
    extract(result, ['diff']) ||
    extract(result, ['patch']) ||
    extract(result, ['unifiedDiff']) ||
    extract(result, ['result.patch']) ||
    extract(result, ['result.diff'])
  if (typeof raw === 'string' && raw.trim()) return raw
  const nestedPatch = extract(result, ['diff.patch'])
  if (typeof nestedPatch === 'string' && nestedPatch.trim()) return nestedPatch
  if (typeof result === 'string' && result.includes('@@')) return result
  return undefined
}

export function isCompletelyNewFile(result: any, diff?: string): boolean {
  const before = extract(result, ['before', 'old', 'previous'])
  const after = extract(result, ['after', 'new'])
  if (!before && after) return true
  const isNewFlag = !!(extract(result, ['isNew']) || extract(result, ['newFile']))
  if (isNewFlag) return true
  if (typeof diff === 'string') {
    const lower = diff.toLowerCase()
    if (lower.includes('new file mode') || lower.includes('--- /dev/null')) return true
  }
  return false
}

export function looksLikeDiffPatchText(text: string): boolean {
  const s = (text || '').trim()
  if (!s) return false
  if (s.includes('@@')) return true
  if (/^Index:\s+/m.test(s)) return true
  if (/^---\s+/m.test(s) && /^\+\+\+\s+/m.test(s)) return true
  return false
}
