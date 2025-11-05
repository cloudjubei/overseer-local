export function IconFileAdded({ className }: { className?: string }) {
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
      {/* Full-size status icon: Added (plus) */}
      <circle cx='12' cy='12' r='9' stroke='#10B981' strokeWidth='2' />
      <path d='M12 8v8' stroke='#10B981' strokeWidth='2' />
      <path d='M8 12h8' stroke='#10B981' strokeWidth='2' />
    </svg>
  )
}
