export function IconHammer({ className }: { className?: string; filled?: boolean }) {
  // Carpenter hammer
  return (
    <svg
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      className={className}
    >
      {/* Handle */}
      <path d='M5 19l7-7' stroke='#3B82F6' strokeWidth='2' />
      {/* Head */}
      <path d='M14 7h4l-2 2h-3' stroke='#F59E0B' strokeWidth='2' />
      {/* Claw curve */}
      <path d='M14 7c-1-1-2-1-3 0l-1 1' stroke='#A855F7' strokeWidth='2' />
    </svg>
  )
}
