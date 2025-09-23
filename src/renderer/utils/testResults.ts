// Utility to parse test run output from thefactory-tools testTools
// Supports structured JSON or plain text output (Vitest/Jest-like)

export type ParsedFailure = {
  testName?: string
  filePath?: string
  line?: number | null
  column?: number | null
  message: string
  stack?: string
}

export type ParsedTestResults = {
  ok: boolean
  rawText: string
  failures: ParsedFailure[]
  summary?: {
    total?: number
    passed?: number
    failed?: number
    skipped?: number
    durationMs?: number
  }
}

function toInt(v: string | undefined | null): number | null {
  if (!v) return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

function tryParseJson(raw: any): ParsedTestResults | null {
  // Some runners may output a structured JSON
  if (!raw) return null
  if (typeof raw === 'object') {
    try {
      const obj = raw
      // Try vitest-like JSON structure
      if (obj && Array.isArray(obj.testResults)) {
        const failures: ParsedFailure[] = []
        for (const tr of obj.testResults) {
          const file = tr.name || tr.file || tr.testFilePath
          if (Array.isArray(tr.assertionResults)) {
            for (const a of tr.assertionResults) {
              if (a.status === 'failed' || a.status === 'fail') {
                const msg: string = Array.isArray(a.failureMessages)
                  ? a.failureMessages.join('\n\n')
                  : a.failureMessages || a.message || 'Test failed'
                failures.push({ testName: a.fullName || a.title, message: msg })
              }
            }
          }
          if (Array.isArray(tr.failures)) {
            for (const f of tr.failures) {
              failures.push({
                testName: f.testName || f.title,
                filePath: f.file || file,
                line: toInt(f.line),
                column: toInt(f.column),
                message: f.message || 'Test failed',
                stack: f.stack,
              })
            }
          }
        }
        const summary = obj.summary || obj.stats || obj
        const total = summary.total || summary.numTotalTests
        const failed = summary.failed || summary.numFailedTests
        const passed = summary.passed || summary.numPassedTests
        const skipped = summary.skipped || summary.numPendingTests
        const durationMs = summary.durationMs || summary.runtime || summary.time
        return {
          ok: failed ? failed === 0 : failures.length === 0,
          rawText: JSON.stringify(obj, null, 2),
          failures,
          summary: { total, failed, passed, skipped, durationMs },
        }
      }
      // Generic object; marshal to string
      return {
        ok: true,
        rawText: JSON.stringify(obj, null, 2),
        failures: [],
      }
    } catch (_) {
      return null
    }
  }
  if (typeof raw === 'string') {
    try {
      const json = JSON.parse(raw)
      return tryParseJson(json)
    } catch (_) {
      return null
    }
  }
  return null
}

// Heuristic regex-based parsing for typical text outputs (Vitest/Jest error blocks)
// Looks for lines like:
//   FAIL path/to/file.test.ts > suite name > test name
//   Error: ...
//   at Object.<anonymous> (src/file.ts:123:45)
// Or Vitest stack with absolute paths ending with ":line:column"

const FILE_LOC_RE = /([\w@\/\\.:\-]+\.(?:[jt]sx?|vue|ts|tsx|json|md|mjs|cjs)):(\d+)(?::(\d+))?/g

function parseFailuresFromText(rawText: string): ParsedFailure[] {
  const lines = rawText.split(/\r?\n/)
  const failures: ParsedFailure[] = []

  // Group lines into blocks separated by blank lines or separator lines
  const blocks: string[][] = []
  let current: string[] = []
  for (const ln of lines) {
    if (ln.trim() === '' || /^\s*-{3,}\s*$/.test(ln)) {
      if (current.length) {
        blocks.push(current)
        current = []
      }
      continue
    }
    current.push(ln)
  }
  if (current.length) blocks.push(current)

  for (const block of blocks) {
    const text = block.join('\n')
    // Find location
    const locMatch = text.match(FILE_LOC_RE)
    // Identify a test name from vitest/jest style headings
    const header = block.find((l) => /\bFAIL\b|\b✖|\bfailing\b/i.test(l)) || block[0]
    let testName: string | undefined
    if (header) {
      // pick the part after 'FAIL ' or split by '>' which Vitest prints for suite > test
      const m = header.match(/FAIL\s+(.+)|✖\s+(.+)/i)
      const h = (m && (m[1] || m[2])) || header
      const parts = h.split('>')
      if (parts.length > 1) testName = parts[parts.length - 1].trim()
      else testName = h.trim()
    }

    // Extract message: look for first line that seems like an error message
    let message = ''
    for (const l of block) {
      if (
        /^Error[:\s]|AssertionError|TypeError|ReferenceError|Expected|Received|\bThrown\b/i.test(l)
      ) {
        message = l.trim()
        break
      }
    }
    if (!message) {
      // fallback to first non-empty line
      message = block.find((l) => l.trim().length > 0)?.trim() || 'Test failed'
    }

    const failure: ParsedFailure = {
      testName,
      message,
    }
    if (locMatch) {
      // Normalize path separators to posix style for matching rel paths in UI
      const p = locMatch[1].replace(/\\/g, '/')
      failure.filePath = p
      failure.line = toInt(locMatch[2])
      failure.column = toInt(locMatch[3])
    }

    // Stack (if present)
    const stackStart = block.findIndex((l) => /\bat\s+/.test(l) || /^\s*Stack/i.test(l))
    if (stackStart >= 0) failure.stack = block.slice(stackStart).join('\n')

    // Consider as a failure block only if it looks like one
    if (/\bFAIL\b|\berror\b|\bexpected\b|\breceived\b|\bthrown\b/i.test(text)) {
      failures.push(failure)
    }
  }

  // If we found none, as a last resort try to find any file:line pattern globally
  if (failures.length === 0) {
    for (const m of rawText.matchAll(FILE_LOC_RE)) {
      failures.push({
        filePath: m[1].replace(/\\/g, '/'),
        line: toInt(m[2]),
        column: toInt(m[3]),
        message: 'Test failed',
      })
    }
  }

  return failures
}

export function parseTestOutput(raw: any): ParsedTestResults {
  const asJson = tryParseJson(raw)
  if (asJson) return asJson

  const rawText = typeof raw === 'string' ? raw : String(raw ?? '')
  const failures = parseFailuresFromText(rawText)

  // Try to infer a summary at the end like: "Test Files  10 passed | 1 failed | 1 skipped"
  let total: number | undefined
  let passed: number | undefined
  let failed: number | undefined
  let skipped: number | undefined

  const summaryLine = rawText
    .split(/\r?\n/)
    .reverse()
    .find((l) => /(passed|failed|skipped)/i.test(l))
  if (summaryLine) {
    const mPassed = summaryLine.match(/(\d+)\s+passed/i)
    const mFailed = summaryLine.match(/(\d+)\s+failed/i)
    const mSkipped = summaryLine.match(/(\d+)\s+(skipped|todo|pending)/i)
    passed = mPassed ? parseInt(mPassed[1], 10) : undefined
    failed = mFailed ? parseInt(mFailed[1], 10) : undefined
    skipped = mSkipped ? parseInt(mSkipped[1], 10) : undefined
    if (passed != null || failed != null || skipped != null) {
      total = [passed, failed, skipped].reduce((a, b) => a! + (b ?? 0), 0)
    }
  }

  return {
    ok: failures.length === 0,
    rawText,
    failures,
    summary: { total, passed, failed, skipped },
  }
}

export function extractRelPath(candidate?: string | null): string | undefined {
  if (!candidate) return undefined
  let p = candidate.trim()
  p = p.replace(/^[A-Za-z]:/, '') // drop windows drive letter for rel attempt
  p = p.replace(/^.*?\/(src|tests?|test|lib|app|packages|server|client)\//, '$1/') // cut leading project root before common dirs
  // Ensure no trailing :line:col
  p = p.replace(/:(\d+)(?::(\d+))?$/, '')
  return p
}
