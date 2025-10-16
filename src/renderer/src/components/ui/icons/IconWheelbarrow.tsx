export function IconWheelbarrow({ className }: { className?: string; filled?: boolean }) {
  // Construction wheelbarrow
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
      {/* Wheel */}
      <circle cx='8' cy='18' r='2' stroke='#EF4444' strokeWidth='2' />
      {/* Tray */}
      <path d='M5 15h8l3-5H8z' stroke='#F59E0B' strokeWidth='2' />
      {/* Handles */}
      <path d='M16 10l5-2' stroke='#A855F7' strokeWidth='2' />
      {/* Leg */}
      <path d='M9 15l-1 3' stroke='#10B981' strokeWidth='2' />
    </svg>
  )
}
