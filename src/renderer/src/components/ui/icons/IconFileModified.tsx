export function IconFileModified({ className }: { className?: string }) {
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
      {/* Full-size status icon: Modified (pencil) */}
      <circle cx='12' cy='12' r='9' stroke='#F59E0B' strokeWidth='2' />
      {/* Pencil glyph */}
      <path d='M9 15l6-6' stroke='#F59E0B' strokeWidth='2' />
      <path d='M14.5 8.5l1 1' stroke='#F59E0B' strokeWidth='2' />
      <path d='M9 15h3' stroke='#F59E0B' strokeWidth='2' />
    </svg>
  )
}
