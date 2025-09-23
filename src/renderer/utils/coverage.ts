export type CoverageFileMetrics = {
  pct_statements: number
  pct_branch: number | null
  pct_functions: number | null
  pct_lines: number
  uncovered_lines: number[]
}

export type ParsedCoverage = {
  files: Record<string, CoverageFileMetrics>
  rawText?: string
}

/**
 * Format a list of uncovered line numbers by grouping consecutive numbers
 * into ranges (e.g., [1,2,3,4,5,8,9,10] -> "1-5,8-10").
 */
export function formatUncoveredLines(
  lines: number[] | undefined | null,
  options?: { maxSegments?: number },
): string {
  if (!Array.isArray(lines) || lines.length === 0) return '—'

  // Normalize: keep positive integers only, sort, and dedupe
  const sorted = Array.from(
    new Set(
      lines
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.trunc(n))
        .filter((n) => n > 0),
    ),
  ).sort((a, b) => a - b)

  if (sorted.length === 0) return '—'

  type Seg = { start: number; end: number }
  const segments: Seg[] = []

  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i]
    if (n === prev + 1) {
      // still consecutive, extend the current range
      prev = n
      continue
    }
    // end current segment and start a new one
    segments.push({ start, end: prev })
    start = n
    prev = n
  }
  // push the last segment
  segments.push({ start, end: prev })

  const maxSegments = options?.maxSegments
  const limited = typeof maxSegments === 'number' && maxSegments > 0 ? segments.slice(0, maxSegments) : segments

  const parts = limited.map((s) => (s.start === s.end ? String(s.start) : `${s.start}-${s.end}`))

  const hasMore = segments.length > (limited === segments ? segments.length : limited.length)
  return hasMore ? `${parts.join(', ')}…` : parts.join(', ')
}
