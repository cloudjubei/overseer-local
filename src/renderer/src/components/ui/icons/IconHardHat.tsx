export function IconHardHat({ className }: { className?: string; filled?: boolean }) {
  // Construction safety hard hat
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
      {/* Brim */}
      <path d='M3 17h18' stroke='#3B82F6' strokeWidth='2' />
      {/* Dome */}
      <path d='M6 17a6 6 0 0 1 12 0' stroke='#F59E0B' strokeWidth='2' />
      {/* Center ridge */}
      <path d='M12 11V7' stroke='#A855F7' strokeWidth='2' />
      {/* Side ridges */}
      <path d='M9 12l-1-2' stroke='#10B981' strokeWidth='2' />
      <path d='M15 12l1-2' stroke='#EF4444' strokeWidth='2' />
    </svg>
  )
}
