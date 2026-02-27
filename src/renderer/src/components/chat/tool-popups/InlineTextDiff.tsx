import React from 'react'
import { type IntraMode, parseUnifiedDiff } from './diffUtils'

type Seg = { t: 'text' | 'ins' | 'del'; v: string }

function renderMarkedText(segs: Seg[], opts: { showDeletions: boolean }) {
  return segs.map((seg, i) => {
    if (seg.t === 'text') return <span key={i}>{seg.v}</span>
    if (seg.t === 'ins') {
      return (
        <span key={i} className="bg-green-300/60 dark:bg-green-700/45 rounded-[2px] px-[1px]">
          {seg.v}
        </span>
      )
    }
    // del
    if (!opts.showDeletions) return null
    return (
      <span
        key={i}
        className="bg-red-300/55 dark:bg-red-700/45 rounded-[2px] px-[1px] line-through decoration-red-600/70 decoration-[1px]"
      >
        {seg.v}
      </span>
    )
  })
}

function mergeAdjacent(segs: Seg[]): Seg[] {
  return segs.reduce<Seg[]>((acc, cur) => {
    const prev = acc[acc.length - 1]
    if (prev && prev.t === cur.t) prev.v += cur.v
    else acc.push({ ...cur })
    return acc
  }, [])
}

function diffMarked(a: string, b: string, mode: IntraMode): Seg[] {
  if (mode === 'none') return [{ t: 'text', v: b }]

  // Tokenize
  const seqA = mode === 'word' ? a.split(/(\s+|\b)/) : a.split('')
  const seqB = mode === 'word' ? b.split(/(\s+|\b)/) : b.split('')
  const n = seqA.length
  const m = seqB.length

  // LCS DP
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = seqA[i] === seqB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  // Single unified walk that emits a contiguous stream.
  const out: Seg[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (seqA[i] === seqB[j]) {
      out.push({ t: 'text', v: seqB[j] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ t: 'del', v: seqA[i] })
      i++
    } else {
      out.push({ t: 'ins', v: seqB[j] })
      j++
    }
  }
  while (i < n) out.push({ t: 'del', v: seqA[i++] })
  while (j < m) out.push({ t: 'ins', v: seqB[j++] })

  return mergeAdjacent(out)
}

export function InlineTextDiff({
  patch,
  intraline = 'word',
  showDeletions = true,
}: {
  patch: string
  intraline?: IntraMode
  showDeletions?: boolean
}) {
  const hunks = React.useMemo(() => parseUnifiedDiff(patch), [patch])

  const { delText, addText, ctxText } = React.useMemo(() => {
    let del = ''
    let add = ''
    let ctx = ''
    for (const h of hunks) {
      for (const ln of h.lines) {
        if (ln.type === 'del') del += ln.text
        else if (ln.type === 'add') add += ln.text
        else if (ln.type === 'ctx') ctx += ln.text
      }
    }
    return { delText: del, addText: add, ctxText: ctx }
  }, [hunks])

  const oldText = delText.length || ctxText.length ? delText || ctxText : ''
  const newText = addText.length || ctxText.length ? addText || ctxText : ''

  const marked = React.useMemo(
    () => diffMarked(oldText, newText, intraline),
    [oldText, newText, intraline],
  )

  // IMPORTANT: this preview must scroll reliably inside the hovercard/tooltip.
  // Many description diffs are effectively one huge wrapped block, which does not always
  // play well with parent overflow containers. So we make this component self-scrollable.
  return (
    <div className="font-mono text-xs text-[var(--text-primary)] bg-[var(--surface-base)] rounded border border-[var(--border-subtle)] max-h-[50vh] overflow-y-auto overflow-x-hidden">
      <pre className="p-2 m-0 whitespace-pre-wrap break-words overflow-wrap-anywhere">
        {renderMarkedText(marked, { showDeletions })}
      </pre>
    </div>
  )
}
