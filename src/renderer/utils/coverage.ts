export type CoverageFile = {
  filePath: string
  statementsPct: number
  branchesPct: number
  functionsPct: number
  linesPct: number
  uncoveredRanges?: { start: number; end?: number }[]
}

export type ParsedCoverage = {
  files: CoverageFile[]
  summary: {
    fileCount: number
    avgStatementsPct: number
    avgBranchesPct: number
    avgFunctionsPct: number
    avgLinesPct: number
  }
  rawText?: string
  raw?: any
}

function toNumberSafe(v: any): number | undefined {
  if (v == null) return undefined
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') {
    const t = v.trim().replace(/%$/, '')
    const n = Number(t)
    return isFinite(n) ? n : undefined
  }
  return undefined
}

function readPct(obj: any, key: string): number | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  // Look for keys like '%statements', 'statementsPct', 'statements'
  const percentKeys = [`%${key}`, `${key}Pct`, key]
  for (const k of percentKeys) {
    if (k in obj) {
      const v = (obj as any)[k]
      if (typeof v === 'object' && v && 'pct' in v) {
        const n = toNumberSafe((v as any).pct)
        if (typeof n === 'number') return Math.max(0, Math.min(100, n))
      }
      const n = toNumberSafe(v)
      if (typeof n === 'number') return Math.max(0, Math.min(100, n))
    }
  }
  // Istanbul summary style e.g. obj.statements.pct
  if (obj[key] && typeof obj[key] === 'object' && 'pct' in obj[key]) {
    const n = toNumberSafe(obj[key].pct)
    if (typeof n === 'number') return Math.max(0, Math.min(100, n))
  }
  return undefined
}

function parseUncoveredRanges(input: any): { start: number; end?: number }[] | undefined {
  if (!input) return undefined
  const arr = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[,\s]+/) : []
  const ranges: { start: number; end?: number }[] = []
  for (const it of arr) {
    if (it == null || it === '') continue
    if (typeof it === 'number' && isFinite(it)) {
      ranges.push({ start: Math.floor(it) })
    } else if (typeof it === 'string') {
      const s = it.trim()
      if (!s) continue
      const m = s.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
      if (m) {
        const a = Number(m[1])
        const b = m[2] ? Number(m[2]) : undefined
        if (isFinite(a)) {
          if (b != null && isFinite(b)) ranges.push({ start: Math.min(a, b), end: Math.max(a, b) })
          else ranges.push({ start: a })
        }
      }
    }
  }
  return ranges.length > 0 ? ranges : undefined
}

function pickUncovered(raw: any): any {
  if (!raw || typeof raw !== 'object') return undefined
  const keys = ['uncovered', 'uncoveredLines', 'uncoveredLineNumbers', 'uncovered_lines']
  for (const k of keys) {
    if (k in raw) return (raw as any)[k]
  }
  return undefined
}

export function parseCoverageOutput(raw: any): ParsedCoverage {
  let json: any = raw
  let rawText: string | undefined
  if (typeof raw === 'string') {
    rawText = raw
    try {
      json = JSON.parse(raw)
    } catch {
      // Not JSON; return minimal structure with raw text
      return {
        files: [],
        summary: {
          fileCount: 0,
          avgStatementsPct: 0,
          avgBranchesPct: 0,
          avgFunctionsPct: 0,
          avgLinesPct: 0,
        },
        rawText,
      }
    }
  }

  const files: CoverageFile[] = []

  const pushFile = (filePath: string, data: any) => {
    const statements = readPct(data, 'statements') ?? readPct(data, 'statement') ?? 0
    const branches = readPct(data, 'branches') ?? readPct(data, 'branch') ?? 0
    const functions = readPct(data, 'functions') ?? readPct(data, 'function') ?? 0
    const lines = readPct(data, 'lines') ?? readPct(data, 'line') ?? 0
    const uncoveredRaw = pickUncovered(data)
    const uncoveredRanges = parseUncoveredRanges(uncoveredRaw)

    files.push({
      filePath,
      statementsPct: statements,
      branchesPct: branches,
      functionsPct: functions,
      linesPct: lines,
      uncoveredRanges,
    })
  }

  if (Array.isArray(json)) {
    for (const it of json) {
      if (!it) continue
      const path = it.file || it.filePath || it.path || it.name
      if (typeof path === 'string') pushFile(path, it)
    }
  } else if (json && typeof json === 'object') {
    // Could be { total, files: {...} } or just map of files
    if (json.files && typeof json.files === 'object') {
      const m = json.files
      for (const k of Object.keys(m)) {
        pushFile(k, m[k])
      }
    } else {
      // treat as map of file -> stat, but skip known keys
      const skip = new Set(['total', 'summary'])
      for (const k of Object.keys(json)) {
        if (skip.has(k)) continue
        const v = (json as any)[k]
        if (v && typeof v === 'object') pushFile(k, v)
      }
    }
  }

  // Sort by worst lines coverage first
  files.sort((a, b) => a.linesPct - b.linesPct)

  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0)

  const summary = {
    fileCount: files.length,
    avgStatementsPct: Number(avg(files.map((f) => f.statementsPct)).toFixed(1)),
    avgBranchesPct: Number(avg(files.map((f) => f.branchesPct)).toFixed(1)),
    avgFunctionsPct: Number(avg(files.map((f) => f.functionsPct)).toFixed(1)),
    avgLinesPct: Number(avg(files.map((f) => f.linesPct)).toFixed(1)),
  }

  return { files, summary, rawText, raw: json }
}
