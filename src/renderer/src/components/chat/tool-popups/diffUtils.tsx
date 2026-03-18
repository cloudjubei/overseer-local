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
          lines: [],
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
    } else if (ln.startsWith('\\')) {
      // \ No newline at end of file
      cur.lines.push({ type: 'meta', text: ln })
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

/** Compute the line range covered by a hunk (first to last actual line number touched) */
function hunkLineRange(hunk: ParsedHunk): { start: number; end: number } {
  const nums: number[] = []
  for (const l of hunk.lines) {
    if (l.oldLine !== undefined) nums.push(l.oldLine)
    if (l.newLine !== undefined) nums.push(l.newLine)
  }
  if (nums.length === 0) {
    return { start: hunk.oldStart, end: hunk.oldStart }
  }
  return { start: Math.min(...nums), end: Math.max(...nums) }
}

export type StructuredUnifiedDiffProps = {
  patch: string
  ignoreWhitespace?: boolean
  wrap?: boolean
  intraline?: IntraMode
  sideBySide?: boolean
  largeGuardLines?: number
  /** Whether selection checkboxes are active */
  selectable?: boolean
  selectedLines?: Set<string>
  onToggleLineSelection?: (hunkIndex: number, lineIndex: number) => void
  onToggleHunkSelection?: (hunkIndex: number) => void
  isStaged?: boolean
  /**
   * Whether edit-mode actions (Stage/Unstage/Discard hunk buttons) should be shown.
   * Independent of `selectable` — buttons show whenever isEditable=true.
   */
  isEditable?: boolean
  onStageHunk?: (hunkIndex: number) => void
  onUnstageHunk?: (hunkIndex: number) => void
  onDiscardHunk?: (hunkIndex: number) => void
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
  const allRows: Array<{
    left?: { line: any; markup?: any }
    right?: { line: any; markup?: any }
    isHeader?: boolean
    headerText?: string
  }> = []

  hunks.forEach((hunk) => {
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

  return (
    <div className='grid grid-cols-2 divide-x divide-neutral-100 dark:divide-neutral-800 h-full w-full'>
      {/* Left Column */}
      <div className='overflow-x-auto overflow-y-hidden'>
        <div className='min-w-fit'>
          {allRows.map((row, idx) => (
            <div key={idx} className='border-b border-neutral-100 dark:border-neutral-800/50 last:border-b-0 h-[22px]'>
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
    selectable = false,
    selectedLines,
    onToggleLineSelection,
    onToggleHunkSelection,
    isStaged = false,
    isEditable = false,
    onStageHunk,
    onUnstageHunk,
    onDiscardHunk,
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
    return (
      <div className='font-mono text-xs text-[var(--text-primary)] bg-[var(--surface-base)] rounded border border-[var(--border-subtle)]'>
        <SideBySideContent hunks={hunks} wrap={wrap} />
      </div>
    )
  }

  // Unified view.
  // Layout strategy: each hunk has a sticky header that spans the full visible width (no horizontal
  // scroll on the header). The lines body scrolls horizontally independently per-hunk via
  // overflow-x-auto on a min-w-max inner div. The parent DiffViewer container owns vertical scroll.
  return (
    <div className='font-mono text-xs text-neutral-800 dark:text-neutral-200 bg-white dark:bg-[#1e1e1e]'>
      {hunks.map((h, i) => {
        const modLines = h.lines.filter(l => l.type === 'add' || l.type === 'del')
        const isHunkFullySelected = modLines.length > 0 && modLines.every((l) => selectedLines?.has(`${i}:${h.lines.indexOf(l)}`))
        const isHunkPartiallySelected = !isHunkFullySelected && modLines.some((l) => selectedLines?.has(`${i}:${h.lines.indexOf(l)}`))
        const { start, end } = hunkLineRange(h)

        return (
          <div key={i} className='border-b border-neutral-200 dark:border-neutral-800 last:border-b-0'>
            {/* Hunk header — sticky, full visible width, never scrolls horizontally */}
            <div className='sticky top-0 z-20 flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-800 px-2 h-8 shrink-0 w-full'>
              {selectable && (
                <input
                  type="checkbox"
                  className="cursor-pointer flex-none"
                  checked={isHunkFullySelected}
                  ref={el => { if (el) el.indeterminate = isHunkPartiallySelected }}
                  onChange={() => onToggleHunkSelection?.(i)}
                />
              )}
              <span className='font-semibold text-neutral-600 dark:text-neutral-300 text-[10px] flex-none'>
                Hunk {i + 1}:
              </span>
              <span className='text-neutral-500 dark:text-neutral-400 text-[10px] flex-none'>
                Lines {start}–{end}
              </span>
              {/* Spacer pushes buttons to the right */}
              <div className='flex-1 min-w-0' />
              {/* Per-hunk action buttons — always visible when isEditable, regardless of selectable */}
              {isEditable && (
                <div className='flex items-center gap-1 flex-none'>
                  <button
                    className={`px-2 py-0.5 rounded text-[10px] font-medium text-white transition-colors ${
                      isStaged
                        ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                        : 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isStaged) {
                        onUnstageHunk?.(i)
                      } else {
                        onStageHunk?.(i)
                      }
                    }}
                  >
                    {isStaged ? 'Unstage Hunk' : 'Stage Hunk'}
                  </button>
                  <button
                    className='px-2 py-0.5 rounded text-[10px] font-medium bg-red-600 hover:bg-red-700 active:bg-red-800 text-white transition-colors'
                    onClick={(e) => {
                      e.stopPropagation()
                      onDiscardHunk?.(i)
                    }}
                  >
                    Discard Hunk
                  </button>
                </div>
              )}
            </div>

            {/* Lines body — scrolls horizontally; vertical scroll is owned by parent */}
            <div className='overflow-x-auto'>
              <div className={wrap ? 'min-w-0' : 'min-w-max'}>
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

                      const isSelectableLine = ln.type === 'add' || ln.type === 'del'

                      return (
                        <div key={j} className={`flex ${bgCls}`}>
                          {selectable && (
                            <div className='w-[24px] flex-none flex items-center justify-center border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30'>
                              {isSelectableLine && (
                                <input
                                  type="checkbox"
                                  className="cursor-pointer"
                                  checked={selectedLines?.has(`${i}:${j}`)}
                                  onChange={() => onToggleLineSelection?.(i, j)}
                                />
                              )}
                            </div>
                          )}
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
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function generateSelectedPatch(
  patch: string,
  selectedLines: Set<string>, // format: "hunkIndex:lineIndex"
): string {
  const hunks = parseUnifiedDiff(patch)

  let out = ''
  const lines = patch.replace(/\r\n/g, '\n').split('\n')
  for (const l of lines) {
    if (l.startsWith('@@')) break
    out += l + '\n'
  }

  for (let hIdx = 0; hIdx < hunks.length; hIdx++) {
    const hunk = hunks[hIdx]
    let oldLinesCount = 0
    let newLinesCount = 0
    let hunkBody = ''
    let hasModifications = false

    let lastLineIncluded: 'add' | 'del' | 'ctx' | null = null

    for (let lIdx = 0; lIdx < hunk.lines.length; lIdx++) {
      const line = hunk.lines[lIdx]
      const isSelected = selectedLines.has(`${hIdx}:${lIdx}`)

      if (line.type === 'meta') {
        // If the preceding line was included (as add/del/ctx), include this meta line.
        // E.g. \ No newline at end of file
        if (lastLineIncluded) {
          hunkBody += line.text + '\n'
        }
        continue
      }

      if (line.type === 'ctx') {
        hunkBody += ' ' + line.text + '\n'
        oldLinesCount++
        newLinesCount++
        lastLineIncluded = 'ctx'
      } else if (line.type === 'add') {
        if (isSelected) {
          hunkBody += '+' + line.text + '\n'
          newLinesCount++
          hasModifications = true
          lastLineIncluded = 'add'
        } else {
          lastLineIncluded = null
        }
      } else if (line.type === 'del') {
        if (isSelected) {
          hunkBody += '-' + line.text + '\n'
          oldLinesCount++
          hasModifications = true
          lastLineIncluded = 'del'
        } else {
          hunkBody += ' ' + line.text + '\n'
          oldLinesCount++
          newLinesCount++
          lastLineIncluded = 'ctx'
        }
      }
    }

    if (hasModifications) {
      out += `@@ -${hunk.oldStart},${oldLinesCount} +${hunk.newStart},${newLinesCount} @@${hunk.header ? ' ' + hunk.header : ''}\n`
      out += hunkBody
    }
  }
  return out.trimEnd() + '\n'
}

/** Generate a patch for a single hunk by index */
export function generateHunkPatch(patch: string, hunkIndex: number): string {
  // Rather than reconstructing the hunk line-by-line and potentially missing edge cases
  // like internal meta lines, we can extract the exact raw string of this hunk.
  // We locate the Nth hunk header and extract everything up to the next hunk header or EOF.
  let out = ''
  const lines = patch.replace(/\r\n/g, '\n').split('\n')
  for (const l of lines) {
    if (l.startsWith('@@')) break
    out += l + '\n'
  }

  let currentHunkIdx = -1
  let inTargetHunk = false

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.startsWith('@@')) {
      currentHunkIdx++
      if (currentHunkIdx === hunkIndex) {
        inTargetHunk = true
      } else if (currentHunkIdx > hunkIndex) {
        break
      }
    }
    
    if (inTargetHunk) {
      out += l + '\n'
    }
  }

  return out.trimEnd() + '\n'
}
