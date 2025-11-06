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
      {/* Corner arrows pointing further inward (minimize) by rotating the inner bend one more step toward center */}
      {/* Top-left inward corner: bend then head further inward */}
      <polyline points='9 3 9 9 3 9' stroke='#0EA5E9' strokeWidth='2' />
      {/* Top-right inward corner */}
      <polyline points='15 3 15 9 21 9' stroke='#0EA5E9' strokeWidth='2' />
      {/* Bottom-right inward corner */}
      <polyline points='15 21 15 15 21 15' stroke='#0EA5E9' strokeWidth='2' />
      {/* Bottom-left inward corner */}
      <polyline points='9 21 9 15 3 15' stroke='#0EA5E9' strokeWidth='2' />
    </svg>
  )
}
