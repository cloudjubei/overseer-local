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
      const m = ln.match(
        /@@\s*-([0-9]+)(?:,([0-9]+))?\s*\+([0-9]+)(?:,([0-9]+))?\s*@@\s*(.*)?/,
      )
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

function diffIntra(
  a: string,
  b: string,
  mode: IntraMode,
): {
  aSegs: Array<{ t: 'text' | 'del'; v: string }>
  bSegs: Array<{ t: 'text' | 'ins'; v: string }>
} {
  if (mode === 'none')
    return { aSegs: [{ t: 'text', v: a }], bSegs: [{ t: 'text', v: b }] }
  const seqA = mode === 'word' ? a.split(/(\s+|\b)/) : a.split('')
  const seqB = mode === 'word' ? b.split(/(\s+|\b)/) : b.split('')
  const n = seqA.length
  const m = seqB.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        seqA[i] === seqB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
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
  const out = hunks.map((h) => ({
    ...h,
    lines: h.lines.map((l) => ({ ...l })),
  }))

  for (const h of out) {
    const dels: { idx: number; text: string }[] = []

    for (let i = 0; i < h.lines.length; i++) {
      const ln = h.lines[i]
      if (ln.type === 'del') {
        dels.push({ idx: i, text: ln.text })
      } else if (ln.type === 'add') {
        if (dels.length > 0) {
          const cand = dels.shift()!
          if (cand) {
            const a = h.lines[cand.idx]
            const b = ln

            let matched = false
            if (opts.ignoreWhitespace) {
              if (normalizeWS(a.text) === normalizeWS(b.text)) {
                a._hidden = true
                b._hidden = true
                matched = true
              }
            }

            if (!matched && opts.intra && opts.intra !== 'none') {
              const { aSegs, bSegs } = diffIntra(a.text, b.text, opts.intra)
              a._markup = aSegs
              b._markup = bSegs
            }
          }
        }
      } else {
        dels.length = 0
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
  sideBySide?: boolean
  largeGuardLines?: number // if exceeded, render a guard instead of full diff
}

function renderCell(item: { line: any; markup?: any } | undefined, side: 'left' | 'right', wrap: boolean) {
  if (!item) {
    return <div className='bg-neutral-50/30 dark:bg-neutral-900/10 min-h-[1.5em]' />
  }
  const { line, markup } = item
  const isDel = line.type === 'del'
  const isAdd = line.type === 'add'

  let bgCls = ''
  if (isDel) bgCls = 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
  else if (isAdd) bgCls = 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'

  const num = side === 'left' ? line.oldLine : line.newLine

  return (
    <div className={`flex w-full ${bgCls} group ${wrap ? 'min-w-0' : 'min-w-max'}`}>
      <div className='w-[40px] flex-none px-1 py-0.5 text-right select-none text-[var(--text-tertiary)] bg-[var(--surface-base)] tabular-nums border-r border-[var(--border-subtle)] pr-1 opacity-70 text-[10px]'>
        {num || ''}
      </div>
      <div className={`px-2 py-0.5 flex-1 ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>
        {markup ? (
          <>
            {markup.map((seg, si) =>
              seg.t === 'text' ? (
                <span key={si}>{seg.v}</span>
              ) : seg.t === 'ins' ? (
                <span key={si} className='bg-green-300/40 dark:bg-green-700/40'>
                  {seg.v}
                </span>
              ) : (
                <span key={si} className='bg-red-300/40 dark:bg-red-700/40 line-through decoration-red-500/60'>
                  {seg.v}
                </span>
              ),
            )}
          </>
        ) : (
          <>{line.text?.length ? line.text : ' '}</>
        )}
      </div>
    </div>
  )
}

function SideBySideContent({ hunks, wrap }: { hunks: ParsedHunk[]; wrap: boolean }) {
  // Pre-calculate all rows to ensure alignment across both columns
  const allRows: Array<{
    left?: { line: any; markup?: any }
    right?: { line: any; markup?: any }
    isHeader?: boolean
    headerText?: string
  }> = []

  hunks.forEach((hunk) => {
    // Add header row
    const left = `-${hunk.oldStart}${typeof hunk.oldLines === 'number' ? ',' + hunk.oldLines : ''}`
    const right = `+${hunk.newStart}${typeof hunk.newLines === 'number' ? ',' + hunk.newLines : ''}`
    const header = `@@ ${left} ${right} @@${hunk.header ? ' ' + hunk.header : ''}`

    allRows.push({ isHeader: true, headerText: header })

    const lines = hunk.lines.filter((l) => l.type !== 'meta' && !l._hidden)
    let i = 0
    while (i < lines.length) {
      const ln = lines[i]
      if (ln.type === 'ctx') {
        allRows.push({ left: { line: ln }, right: { line: ln } })
        i++
        continue
      }

      const blockDels: any[] = []
      const blockAdds: any[] = []

      while (i < lines.length && lines[i].type !== 'ctx') {
        if (lines[i].type === 'del') blockDels.push(lines[i])
        else if (lines[i].type === 'add') blockAdds.push(lines[i])
        i++
      }

      const max = Math.max(blockDels.length, blockAdds.length)
      for (let k = 0; k < max; k++) {
        allRows.push({
          left: blockDels[k] ? { line: blockDels[k], markup: blockDels[k]._markup } : undefined,
          right: blockAdds[k] ? { line: blockAdds[k], markup: blockAdds[k]._markup } : undefined,
        })
      }
    }
  })

  // Render two separate columns
  return (
    <div className='grid grid-cols-2 divide-x divide-neutral-100 dark:divide-neutral-800 h-full w-full'>
      {/* Left Column */}
      <div className='overflow-x-auto overflow-y-hidden'>
        <div className='min-w-fit'>
          {allRows.map((row, idx) => (
            <div key={idx} className='border-b border-neutral-100 dark:border-neutral-800/50 last:border-b-0 h-[22px]'>
              {/* Fixed height for alignment */}
              {row.isHeader ? (
                <div className='bg-[var(--surface-overlay)] text-[var(--text-secondary)] px-2 py-0.5 text-[10px] border-b border-[var(--border-subtle)] border-t first:border-t-0 sticky top-0 z-20 whitespace-nowrap overflow-hidden text-ellipsis h-full'>
                  {row.headerText}
                </div>
              ) : (
                renderCell(row.left, 'left', wrap)
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Column */}
      <div className='overflow-x-auto overflow-y-hidden'>
        <div className='min-w-fit'>
          {allRows.map((row, idx) => (
            <div key={idx} className='border-b border-neutral-100 dark:border-neutral-800/50 last:border-b-0 h-[22px]'>
              {/* Fixed height for alignment */}
              {row.isHeader ? (
                <div className='bg-[var(--surface-overlay)] text-[var(--text-secondary)] px-2 py-0.5 text-[10px] border-b border-[var(--border-subtle)] border-t first:border-t-0 sticky top-0 z-20 whitespace-nowrap overflow-hidden text-ellipsis h-full'>
                  {row.headerText}
                </div>
              ) : (
                renderCell(row.right, 'right', wrap)
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function StructuredUnifiedDiff(props: StructuredUnifiedDiffProps) {
  const {
    patch,
    ignoreWhitespace = false,
    wrap = false,
    intraline = 'none',
    sideBySide = false,
    largeGuardLines = 5000,
  } = props

  const hunksRaw = React.useMemo(() => parseUnifiedDiff(patch), [patch])
  const totalRenderableLines = React.useMemo(
    () => hunksRaw.reduce((acc, h) => acc + h.lines.filter((l) => l.type !== 'meta' && !l._hidden).length, 0),
    [hunksRaw],
  )

  const [guardBypass, setGuardBypass] = React.useState(false)
  const hunks = React.useMemo(() => annotateHunks(hunksRaw, { ignoreWhitespace, intra: intraline }), [
    hunksRaw,
    ignoreWhitespace,
    intraline,
  ])

  const headerText = (h: ParsedHunk) => {
    const left = `-${h.oldStart}${typeof h.oldLines === 'number' ? ',' + h.oldLines : ''}`
    const right = `+${h.newStart}${typeof h.newLines === 'number' ? ',' + h.newLines : ''}`
    return `@@ ${left} ${right} @@${h.header ? ' ' + h.header : ''}`
  }

  if (!guardBypass && totalRenderableLines > largeGuardLines) {
    return (
      <div className='text-xs text-neutral-600 dark:text-neutral-400 p-2 border border-neutral-200 dark:border-neutral-800 rounded'>
        <div>Diff is very large ({totalRenderableLines} lines). Showing it might freeze the UI.</div>
        <button
          onClick={() => setGuardBypass(true)}
          className='mt-2 px-3 py-1 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded text-xs'
        >
          Show anyway
        </button>
      </div>
    )
  }

  if (sideBySide) {
    // Scroll container wraps the SideBySideContent
    // But we need vertical scrolling to be sync, and horizontal async.
    // SideBySideContent renders two columns. We put the vertical scroll on the wrapper.
    return (
      <div className='font-mono text-xs text-[var(--text-primary)] bg-[var(--surface-base)] rounded border border-[var(--border-subtle)] overflow-y-auto max-h-[60vh]'>
        <SideBySideContent hunks={hunks} wrap={wrap} />
      </div>
    )
  }

  // Unified view
  return (
    <div className='font-mono text-xs text-neutral-800 dark:text-neutral-200 bg-white dark:bg-[#1e1e1e] rounded border border-neutral-200 dark:border-neutral-800 overflow-auto max-h-[60vh]'>
      <div className={wrap ? 'min-w-0' : 'min-w-max'}>
        {hunks.map((h, i) => (
          <div key={i}>
            <div className='bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-500 px-2 py-1 text-[10px] border-b border-neutral-200 dark:border-neutral-800 border-t first:border-t-0 sticky top-0 z-20 w-full'>
              {headerText(h)}
            </div>
            <div className='text-[10px] leading-relaxed divide-y divide-neutral-100 dark:divide-neutral-800/50'>
              {h.lines
                .filter((l) => !l._hidden)
                .map((ln, j) => {
                  if (ln.type === 'meta') return null
                  let bgCls = ''
                  let marker = ' '
                  if (ln.type === 'add') {
                    bgCls = 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    marker = '+'
                  } else if (ln.type === 'del') {
                    bgCls = 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    marker = '-'
                  }

                  return (
                    <div key={j} className={`flex ${bgCls} group ${wrap ? 'min-w-0' : 'min-w-max'}`}>
                      {/* Line numbers */}
                      <div className='w-[60px] flex-none flex text-right select-none text-neutral-400 dark:text-neutral-600 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 text-[10px]'>
                        <span className='w-1/2 pr-1'>{ln.oldLine !== undefined ? ln.oldLine : ''}</span>
                        <span className='w-1/2 pr-1'>{ln.newLine !== undefined ? ln.newLine : ''}</span>
                      </div>

                      <div className='w-4 flex-none text-center select-none opacity-50 text-[10px]'>{marker}</div>
                      <div className={`flex-1 min-w-0 py-0.5 pr-2 ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>
                        {ln._markup ? (
                          <>
                            {ln._markup.map((seg, si) =>
                              seg.t === 'text' ? (
                                <span key={si}>{seg.v}</span>
                              ) : seg.t === 'ins' ? (
                                <span
                                  key={si}
                                  className='bg-green-300/60 dark:bg-green-700/45 rounded-[2px] px-[1px]'
                                >
                                  {seg.v}
                                </span>
                              ) : (
                                <span
                                  key={si}
                                  className='bg-red-300/55 dark:bg-red-700/45 rounded-[2px] px-[1px] line-through decoration-red-600/70 decoration-[1px]'
                                >
                                  {seg.v}
                                </span>
                              ),
                            )}
                          </>
                        ) : (
                          <>{ln.text?.length ? ln.text : ' '}</>
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
