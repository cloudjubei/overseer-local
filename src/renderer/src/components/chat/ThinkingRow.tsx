import React, { memo } from 'react'
import Spinner from '../ui/Spinner'

function ThinkingRow() {
  return (
    <div className='flex items-start gap-2 flex-row'>
      <div
        className='shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
        aria-hidden='true'
      >
        AI
      </div>
      <div className='max-w-[72%] min-w-[80px] flex flex-col items-start'>
        <div className='overflow-x-auto max-w-full px-3 py-2 rounded-2xl whitespace-pre-wrap break-words break-all shadow bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-md'>
          <Spinner />
        </div>
      </div>
    </div>
  )
}

export default memo(ThinkingRow)
