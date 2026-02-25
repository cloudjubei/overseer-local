import React from 'react'

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className='text-[11px] font-semibold text-[var(--text-secondary)] mb-1'>
      {children}
    </div>
  )
}
