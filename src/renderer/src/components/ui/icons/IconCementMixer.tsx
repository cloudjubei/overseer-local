export function IconCementMixer({ className }: { className?: string; filled?: boolean }) {
  // Portable cement mixer with drum and wheel
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
      {/* Frame */}
      <path d='M6 16h7l3-3' stroke='#10B981' strokeWidth='2' />
      {/* Wheel */}
      <circle cx='8' cy='18' r='2' stroke='#EF4444' strokeWidth='2' />
      {/* Drum */}
      <path d='M14 8l3 3-3 3-3-3 3-3z' stroke='#F59E0B' strokeWidth='2' />
      {/* Handle */}
      <path d='M17 11h3' stroke='#A855F7' strokeWidth='2' />
    </svg>
  )
}
