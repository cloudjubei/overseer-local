import React from 'react'

export function IconEye({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      {/* Classic eye icon */}
      <path d='M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  )
}
