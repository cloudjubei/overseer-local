import React from 'react'

export function IconMinimize({ className }: { className?: string }) {
  return (
    <svg
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      {/* Corner arrows pointing inwards (minimize) */}
      <polyline points='3 8 3 3 8 3' stroke='#0EA5E9' strokeWidth='2' />
      <polyline points='21 8 21 3 16 3' stroke='#0EA5E9' strokeWidth='2' />
      <polyline points='16 21 21 21 21 16' stroke='#0EA5E9' strokeWidth='2' />
      <polyline points='8 21 3 21 3 16' stroke='#0EA5E9' strokeWidth='2' />
    </svg>
  )
}
