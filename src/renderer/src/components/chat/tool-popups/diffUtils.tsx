import React from 'react'

export type ParsedHunk = {
  header?: string
  oldStart: number
  oldLines?: number
  newStart: number
  newLines?: number
  lines: Array<{
    type: 'add' | 'del' | 'ctx' | 'meta'
    text: string
    oldLine?: number
    newLine?: number
    // Render-time annotations (optional)
    _hidden?: boolean
    _markup?: Array<{ t: 'text' | 'ins' | 'del'; v: string }>
  }>
}

export function parseUnifiedDiff(patch: string): ParsedHunk[] {
  const out: ParsedHunk[] = []
  if (!patch) return out
  const lines = patch.replace(/\r\n/g, '\n').split('\n')
  let cur: ParsedHunk | null = null
  let oldLine = 0
  let newLine = 0
  for (const ln of lines) {
    if (ln.startsWith('@@')) {
      const m = ln.match(/@@\s*-([0-9]+)(?:,([0-9]+))?\s*\+([0-9]+)(?:,([0-9]+))?\s*@@\s*(.*)?/)
      if (m) {
        if (cur) out.push(cur)
        oldLine = parseInt(m[1], 10) - 1
        newLine = parseInt(m[3], 10) - 1
        cur = {
          header: m[5] || undefined,
          oldStart: oldLine + 1,
          oldLines: m[2] ? parseInt(m[2], 10) : undefined,
          newStart: newLine + 1,
          newLines: m[4] ? parseInt(m[4], 10) : undefined,
          lines: [{ type: 'meta', text: ln } as any],
        }
        continue
      }
    }
    if (!cur) continue
    if (ln.startsWith('+++ ') || ln.startsWith('--- ')) continue

    if (ln.startsWith('+')) {
      newLine += 1
      cur.lines.push({ type: 'add', text: ln.slice(1), newLine })
    } else if (ln.startsWith('-')) {
      oldLine += 1
      cur.lines.push({ type: 'del', text: ln.slice(1), oldLine })
    } else if (ln.startsWith(' ')) {
      oldLine += 1
      newLine += 1
      cur.lines.push({ type: 'ctx', text: ln.slice(1), oldLine, newLine })
    } else {
      cur.lines.push({ type: 'ctx', text: ln })
    }
  }
  if (cur) out.push(cur)
  return out
}

export type IntraMode = 'none' | 'word' | 'char'

function normalizeWS(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function diffIntra(a: string, b: string, mode: IntraMode): {
  aSegs: Array<{ t: 'text' | 'del'; v: string }>
  bSegs: Array<{ t: 'text' | 'ins'; v: string }>
} {
  if (mode === 'none') return { aSegs: [{ t: 'text', v: a }], bSegs: [{ t: 'text', v: b }] }
  const seqA = mode === 'word' ? a.split(/(\s+|\b)/) : a.split('')
  const seqB = mode === 'word' ? b.split(/(\s+|\b)/) : b.split('')
  const n = seqA.length
  const m = seqB.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = seqA[i] === seqB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const aOut: Array<{ t: 'text' | 'del'; v: string }> = []
  const bOut: Array<{ t: 'text' | 'ins'; v: string }> = []
  let i = 0,
    j = 0
  while (i < n && j < m) {
    if (seqA[i] === seqB[j]) {
      aOut.push({ t: 'text', v: seqA[i] })
      bOut.push({ t: 'text', v: seqB[j] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      aOut.push({ t: 'del', v: seqA[i++] })
    } else {
      bOut.push({ t: 'ins', v: seqB[j++] })
    }
  }
  while (i < n) aOut.push({ t: 'del', v: seqA[i++] })
  while (j < m) bOut.push({ t: 'ins', v: seqB[j++] })
  const merge = <T extends { t: any; v: string }>(arr: T[]) =>
    arr.reduce<T[]>((acc, cur) => {
      const prev = acc[acc.length - 1]
      if (prev && prev.t === cur.t) prev.v += cur.v
      else acc.push({ ...cur })
      return acc
    }, [])
  return { aSegs: merge(aOut), bSegs: merge(bOut) }
}

function annotateHunks(
  hunks: ParsedHunk[],
  opts: { ignoreWhitespace?: boolean; intra?: IntraMode },
): ParsedHunk[] {
  if (!opts.ignoreWhitespace && (!opts.intra || opts.intra === 'none')) return hunks
  const out = hunks.map((h) => ({ ...h, lines: h.lines.map((l) => ({ ...l })) }))
  for (const h of out) {
    const dels: { idx: number; text: string }[] = []
    for (let i = 0; i < h.lines.length; i++) {
      const ln = h.lines[i]
      if (ln.type === 'del') {
        dels.push({ idx: i, text: ln.text })
      } else if (ln.type === 'add') {
        let pair: { idx: number; text: string } | undefined
        while (dels.length) {
          const cand = dels.pop()!
          if (!h.lines[cand.idx]._hidden) {
            pair = cand
            break
          }
        }
        if (!pair) continue
        const a = h.lines[pair.idx]
        const b = ln
        if (opts.ignoreWhitespace) {
          if (normalizeWS(a.text) === normalizeWS(b.text)) {
            a._hidden = true
            b._hidden = true
          }
        }
        if (opts.intra && opts.intra !== 'none') {
          const { aSegs, bSegs } = diffIntra(a.text, b.text, opts.intra)
          a._markup = aSegs
          b._markup = bSegs
        }
      }
    }
  }
  return out
}

export type StructuredUnifiedDiffProps = {
  patch: string
  ignoreWhitespace?: boolean
  wrap?: boolean
  intraline?: IntraMode
  largeGuardLines?: number // if exceeded, render a guard instead of full diff
}

// Note: parent should control scrolling; we render all hunks unless largeGuard triggers.
export function StructuredUnifiedDiff(props: StructuredUnifiedDiffProps) {
  const { patch, ignoreWhitespace = false, wrap = false, intraline = 'none', largeGuardLines = 5000 } = props
  const hunksRaw = React.useMemo(() => parseUnifiedDiff(patch), [patch])
  const totalRenderableLines = React.useMemo(
    () => hunksRaw.reduce((acc, h) => acc + h.lines.filter((l) => l.type !== 'meta').length, 0),
    [hunksRaw],
  )
  const [guardBypass, setGuardBypass] = React.useState(false)
  const hunks = React.useMemo(
    () => annotateHunks(hunksRaw, { ignoreWhitespace, intra: intraline }),
    [hunksRaw, ignoreWhitespace, intraline],
  )

  const headerText = (h: ParsedHunk) => {
    const left = `-${h.oldStart}${typeof h.oldLines === 'number' ? ',' + h.oldLines : ''}`
    const right = `+${h.newStart}${typeof h.newLines === 'number' ? ',' + h.newLines : ''}`
    return `@@ ${left} ${right} @@${h.header ? ' ' + h.header : ''}`
  }

  if (!guardBypass && totalRenderableLines > largeGuardLines) {
    return (
      <div className='text-xs text-neutral-600 dark:text-neutral-400 p-2 border border-neutral-200 dark:border-neutral-800 rounded'>
        <div className='mb-1'>Diff is large ({totalRenderableLines.toLocaleString()} lines). Rendering may be slow.</div>
        <button className='btn btn-sm' onClick={() => setGuardBypass(true)}>Render anyway</button>
      </div>
    )
  }

  return (
    <div className='font-mono text-[11px] w-full'>
      <div className='inline-block min-w-full'>
        {hunks.map((hunk, hi) => (
          <div key={hi} className='mb-3 w-full'>
            <div className='px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300 w-full'>
              {headerText(hunk)}
            </div>
            <div>
              {hunk.lines
                .filter((ln) => ln.type !== 'meta' && !ln._hidden)
                .map((ln, li) => {
                  const isAdd = ln.type === 'add'
                  const isDel = ln.type === 'del'
                  const bgCls = isAdd
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : isDel
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : ''
                  const marker = isAdd ? '+' : isDel ? '-' : ' '
                  return (
                    <div key={li} className={`grid grid-cols-[56px_56px_1fr] w-full ${bgCls}`}>
                      <div className='px-2 py-0.5 text-right select-none text-neutral-500 dark:text-neutral-400 tabular-nums'>
                        {typeof (ln as any).oldLine === 'number' ? (ln as any).oldLine : ''}
                      </div>
                      <div className='px-2 py-0.5 text-right select-none text-neutral-500 dark:text-neutral-400 tabular-nums'>
                        {typeof (ln as any).newLine === 'number' ? (ln as any).newLine : ''}
                      </div>
                      <div className={`px-2 py-0.5 ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>
                        <span className='opacity-60'>{marker}</span>
                        {ln._markup && (ln.type === 'add' || ln.type === 'del') ? (
                          <>
                            {' '}
                            {ln._markup.map((seg, si) =>
                              seg.t === 'text' ? (
                                <span key={si}>{seg.v}</span>
                              ) : seg.t === 'ins' ? (
                                <span key={si} className='bg-green-300/40 dark:bg-green-700/40'>{seg.v}</span>
                              ) : (
                                <span key={si} className='bg-red-300/40 dark:bg-red-700/40 line-through decoration-red-500/60'>
                                  {seg.v}
                                </span>
                              ),
                            )}
                          </>
                        ) : (
                          <>{(ln as any).text?.length ? ' ' + (ln as any).text : ' '}</>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
