import React from 'react'

export function InlineOldNew({
  oldVal,
  newVal,
}: {
  oldVal?: string
  newVal?: string
}) {
  if (!oldVal && !newVal) return null

  return (
    <div className='text-xs space-y-1'>
      {oldVal ? (
        <div>
          <div className='text-[11px] text-[var(--text-secondary)]'>Old</div>
          <pre className='text-[11px] font-mono whitespace-pre-wrap break-words'>{oldVal}</pre>
        </div>
      ) : null}
      {newVal ? (
        <div>
          <div className='text-[11px] text-[var(--text-secondary)]'>New</div>
          <pre className='text-[11px] font-mono whitespace-pre-wrap break-words'>{newVal}</pre>
        </div>
      ) : null}
    </div>
  )
}
