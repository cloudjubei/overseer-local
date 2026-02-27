import React from 'react'
import { StructuredUnifiedDiff, type IntraMode } from './diffUtils'

export function SimpleUnifiedDiff({
  patch,
  intraline = 'none',
}: {
  patch: string
  intraline?: IntraMode
}) {
  // Purpose:
  // - Handle very long single-line diffs (e.g. story/feature descriptions)
  // - Wrap long lines instead of forcing horizontal scroll
  // - Provide intraline insert/delete highlighting in-place
  // - Keep only vertical scrolling
  //
  // NOTE: no max-h or overflow here — the parent container owns scrolling.
  return (
    <div className='min-w-0'>
      <StructuredUnifiedDiff patch={patch} wrap={true} intraline={intraline} sideBySide={false} />
    </div>
  )
}

export function SimpleSplitText({
  oldText,
  newText,
  oldLabel = 'Before',
  newLabel = 'After',
}: {
  oldText?: string
  newText?: string
  oldLabel?: string
  newLabel?: string
}) {
  // Split view: plain text side-by-side (no diff markers).
  // No max-h or overflow here — the parent container owns scrolling.
  return (
    <div className='grid grid-cols-2 gap-2'>
      <div className='min-w-0 rounded border border-[var(--border-subtle)] bg-[var(--surface-base)]'>
        <div className='px-2 py-1 text-[10px] text-[var(--text-secondary)] border-b border-[var(--border-subtle)]'>
          {oldLabel}
        </div>
        <pre className='m-0 p-2 text-[11px] whitespace-pre-wrap break-words'>
          {oldText || ''}
        </pre>
      </div>

      <div className='min-w-0 rounded border border-[var(--border-subtle)] bg-[var(--surface-base)]'>
        <div className='px-2 py-1 text-[10px] text-[var(--text-secondary)] border-b border-[var(--border-subtle)]'>
          {newLabel}
        </div>
        <pre className='m-0 p-2 text-[11px] whitespace-pre-wrap break-words'>
          {newText || ''}
        </pre>
      </div>
    </div>
  )
}
