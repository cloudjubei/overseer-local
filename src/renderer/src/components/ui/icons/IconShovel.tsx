export function IconShovel({ className }: { className?: string; filled?: boolean }) {
  // Construction shovel
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
      <path d='M5 5l7 7' stroke='#3B82F6' strokeWidth='2' />
      {/* Grip */}
      <path d='M4 4l2-2 2 2-2 2-2-2z' stroke='#A855F7' strokeWidth='2' />
      {/* Blade */}
      <path d='M14 12c1.5 1.5 1.5 3.5 0 5l-2 2-3-3 2-2c1.5-1.5 3.5-1.5 5 0z' stroke='#F59E0B' strokeWidth='2' />
    </svg>
  )
}
