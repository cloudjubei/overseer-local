export function IconCrane({ className }: { className?: string; filled?: boolean }) {
  // Tower crane with jib and hook
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
      {/* Base */}
      <path d='M4 20h16' stroke='#3B82F6' strokeWidth='2' />
      {/* Mast */}
      <path d='M7 20V6' stroke='#A855F7' strokeWidth='2' />
      {/* Jib */}
      <path d='M7 6h10' stroke='#F59E0B' strokeWidth='2' />
      {/* Counter-jib */}
      <path d='M7 6H4' stroke='#10B981' strokeWidth='2' />
      {/* Trolley and hook */}
      <path d='M13 6v5' stroke='#EF4444' strokeWidth='2' />
      <path d='M13 13c0 1 .8 2 2 2' stroke='#EF4444' strokeWidth='2' />
    </svg>
  )
}
