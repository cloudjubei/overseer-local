export function IconSafetyVest({ className }: { className?: string; filled?: boolean }) {
  // Safety vest front view
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
      {/* Shoulders */}
      <path d='M7 4l-2 3v11h5V9' stroke='#3B82F6' strokeWidth='2' />
      <path d='M17 4l2 3v11h-5V9' stroke='#3B82F6' strokeWidth='2' />
      {/* Front opening */}
      <path d='M12 5v14' stroke='#A855F7' strokeWidth='2' />
      {/* Reflective stripes */}
      <path d='M5 12h14' stroke='#F59E0B' strokeWidth='2' />
      <path d='M5 15h14' stroke='#10B981' strokeWidth='2' />
    </svg>
  )
}
