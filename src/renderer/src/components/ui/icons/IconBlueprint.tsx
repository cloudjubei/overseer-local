export function IconBlueprint({ className }: { className?: string; filled?: boolean }) {
  // Architectural blueprint scroll
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
      {/* Sheet */}
      <rect x='5' y='5' width='12' height='14' rx='2' stroke='#3B82F6' strokeWidth='2' />
      {/* Rolled corner */}
      <path d='M17 15l2 2-2 2' stroke='#A855F7' strokeWidth='2' />
      {/* Grid lines */}
      <path d='M8 8h6M8 11h6M8 14h6' stroke='#10B981' strokeWidth='2' />
      {/* Dimension marker */}
      <path d='M8 17h6' stroke='#F59E0B' strokeWidth='2' />
    </svg>
  )
}
