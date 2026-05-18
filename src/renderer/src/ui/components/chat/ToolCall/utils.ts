/**
 * Defensive accessors used by every tool renderer. Tool-call payloads are
 * loosely typed — the renderer needs to read shapes the SDK doesn't promise
 * (e.g. `result.diff.patch`) without crashing on missing keys.
 */

export function tryString(v: unknown): string | undefined {
  if (v == null) return undefined
  try {
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function extract(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  for (const k of keys) {
    const parts = k.split('.')
    let cur: unknown = obj
    let ok = true
    for (const p of parts) {
      if (cur && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, p)) {
        cur = (cur as Record<string, unknown>)[p]
      } else {
        ok = false
        break
      }
    }
    if (ok) return cur
  }
  return undefined
}

export function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

export function looksLikeDiffPatchText(text: string): boolean {
  const s = (text || '').trim()
  if (!s) return false
  if (s.includes('@@')) return true
  if (/^Index:\s+/m.test(s)) return true
  if (/^---\s+/m.test(s) && /^\+\+\+\s+/m.test(s)) return true
  return false
}
