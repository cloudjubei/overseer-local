import React from 'react'

export type ParsedHunk = {
  header?: string
  oldStart: number
  oldLines?: number
  newStart: number
  newLines?: number
  lines: Array<{ type: 'add' | 'del' | 'ctx' | 'meta'; text: string; oldLine?: number; newLine?: number }>
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

// Note: parent should control scrolling. We always render all hunks and stretch to full width.
export function StructuredUnifiedDiff({ patch }: { patch: string }) {
  const hunks = React.useMemo(() => parseUnifiedDiff(patch), [patch])

  const headerText = (h: ParsedHunk) => {
    const left = `-${h.oldStart}${typeof h.oldLines === 'number' ? ',' + h.oldLines : ''}`
    const right = `+${h.newStart}${typeof h.newLines === 'number' ? ',' + h.newLines : ''}`
    return `@@ ${left} ${right} @@${h.header ? ' ' + h.header : ''}`
  }

  return (
    <div className="font-mono text-[11px] w-full">
      {/* Inner block is at least full width; it can grow wider so the parent shows a horizontal scrollbar. */}
      <div className="inline-block min-w-full">
        {hunks.map((hunk, hi) => (
          <div key={hi} className="mb-3 w-full">
            <div className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300 w-full">
              {headerText(hunk)}
            </div>
            <div>
              {hunk.lines
                .filter((ln) => ln.type !== 'meta')
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
                      <div className="px-2 py-0.5 text-right select-none text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {typeof (ln as any).oldLine === 'number' ? (ln as any).oldLine : ''}
                      </div>
                      <div className="px-2 py-0.5 text-right select-none text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {typeof (ln as any).newLine === 'number' ? (ln as any).newLine : ''}
                      </div>
                      <div className="px-2 py-0.5 whitespace-pre">
                        <span className="opacity-60">{marker}</span>
                        {(ln as any).text?.length ? ' ' + (ln as any).text : ' '}
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
