import React from 'react'

export function IconMaximize({ className }: { className?: string }) {
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
      {/* Corner arrows pointing outwards (maximize) */}
      <polyline points='9 3 3 3 3 9' stroke='#0EA5E9' strokeWidth='2' />
      <polyline points='15 3 21 3 21 9' stroke='#0EA5E9' strokeWidth='2' />
      <polyline points='21 15 21 21 15 21' stroke='#0EA5E9' strokeWidth='2' />
      <polyline points='9 21 3 21 3 15' stroke='#0EA5E9' strokeWidth='2' />
    </svg>
  )
}
