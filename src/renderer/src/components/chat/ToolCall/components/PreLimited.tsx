import React, { useMemo, useState } from 'react'

export function PreLimited({
  lines,
  maxLines = 10,
  renderTruncationMessage,
}: {
  lines: string[]
  maxLines?: number
  renderTruncationMessage?: (omitted: number) => React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)

  const { shownLines, omitted } = useMemo(() => {
    const safe = Array.isArray(lines) ? lines : []
    if (expanded) return { shownLines: safe, omitted: 0 }
    const slice = safe.slice(0, maxLines)
    return { shownLines: slice, omitted: Math.max(0, safe.length - slice.length) }
  }, [lines, maxLines, expanded])

  return (
    <div>
      <pre className='text-[11px] font-mono whitespace-pre-wrap break-words'>
        {shownLines.join('\n')}
      </pre>
      {omitted > 0 ? (
        <button
          type='button'
          className='text-[11px] text-[var(--text-secondary)] hover:underline'
          onClick={() => setExpanded(true)}
        >
          {renderTruncationMessage ? renderTruncationMessage(omitted) : `+ ${omitted} more`}
        </button>
      ) : null}
    </div>
  )
}
