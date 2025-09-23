// Coverage parsing utility that accepts multiple shapes
// Primary support is for the run_test_coverage tool contract and generic objects from thefactory-tools

import { CoverageFileStats } from 'thefactory-tools'

export type ParsedCoverage = {
  files: Record<string, CoverageFileStats>
  rawText?: string
  summary?: {
    pct_statements?: number
    pct_branch?: number | null
    pct_functions?: number | null
    pct_lines?: number
  }
}

function toPct(n: any): number | null {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? parseFloat(n) : NaN
  return Number.isFinite(v) ? v : null
}

function toNum(n: any): number | null {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? parseFloat(n) : NaN
  return Number.isFinite(v) ? v : null
}

export function parseCoverageOutput(raw: any): ParsedCoverage {
  // If input already resembles our normalized shape
  if (raw && typeof raw === 'object' && raw.files && typeof raw.files === 'object') {
    const out: ParsedCoverage = { files: {} }
    for (const [file, data] of Object.entries<any>(raw.files)) {
      out.files[file] = {
        pct_statements: toPct((data as any).pct_statements) ?? 0,
        pct_branch: toPct((data as any).pct_branch),
        pct_functions: toPct((data as any).pct_functions),
        pct_lines: toPct((data as any).pct_lines) ?? 0,
        uncovered_lines: Array.isArray((data as any).uncovered_lines)
          ? (data as any).uncovered_lines.filter((n: any) => typeof n === 'number')
          : [],
      }
    }
    // Try to compute a simple average summary
    const filesArr = Object.values(out.files)
    if (filesArr.length > 0) {
      const avg = (getter: (f: CoverageFileStats) => number | null) => {
        const vals = filesArr.map(getter).filter((v): v is number => typeof v === 'number')
        if (!vals.length) return undefined
        return vals.reduce((a, b) => a + b, 0) / vals.length
      }
      out.summary = {
        pct_statements: avg((f) => f.pct_statements) ?? undefined,
        pct_branch: avg((f) => f.pct_branch) ?? null,
        pct_functions: avg((f) => f.pct_functions) ?? null,
        pct_lines: avg((f) => f.pct_lines) ?? undefined,
      }
    }
    return out
  }

  // If it's a string, attempt JSON parse first
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parseCoverageOutput(parsed)
    } catch (_) {
      return { files: {}, rawText: raw }
    }
  }

  // Generic object without files map, try to infer Istanbul-like summary
  if (raw && typeof raw === 'object') {
    const out: ParsedCoverage = { files: {}, rawText: undefined }
    // Some tools might return an array of files with keys
    if (Array.isArray((raw as any).files)) {
      for (const item of (raw as any).files) {
        const name = (item as any).path || (item as any).file || (item as any).name
        if (!name) continue
        out.files[name] = {
          pct_statements:
            toPct((item as any).statements) ?? toPct((item as any).pct_statements) ?? 0,
          pct_branch: toPct((item as any).branches) ?? toPct((item as any).pct_branch),
          pct_functions: toPct((item as any).functions) ?? toPct((item as any).pct_functions),
          pct_lines: toPct((item as any).lines) ?? toPct((item as any).pct_lines) ?? 0,
          uncovered_lines: Array.isArray((item as any).uncovered_lines)
            ? (item as any).uncovered_lines.filter((n: any) => typeof n === 'number')
            : [],
        }
      }
    }

    try {
      out.rawText = JSON.stringify(raw, null, 2)
    } catch (_) {
      // ignore
    }

    return out
  }

  // Fallback
  return { files: {}, rawText: String(raw ?? '') }
}
