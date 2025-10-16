export function IconExcavator({ className }: { className?: string; filled?: boolean }) {
  // Excavator with arm and bucket
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
      {/* Ground */}
      <path d='M3 20h18' stroke='#3B82F6' strokeWidth='2' />
      {/* Tracks */}
      <circle cx='8' cy='18' r='2' stroke='#EF4444' strokeWidth='2' />
      <circle cx='14' cy='18' r='2' stroke='#EF4444' strokeWidth='2' />
      {/* Body */}
      <path d='M6 16h10l2-3' stroke='#10B981' strokeWidth='2' />
      {/* Cabin */}
      <path d='M9 12h4v4H9z' stroke='#A855F7' strokeWidth='2' />
      {/* Arm and bucket */}
      <path d='M15 11l4-3' stroke='#F59E0B' strokeWidth='2' />
      <path d='M19 8l2 3-2 1' stroke='#F59E0B' strokeWidth='2' />
    </svg>
  )
}
