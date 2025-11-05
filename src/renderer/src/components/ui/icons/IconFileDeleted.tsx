export function IconFileDeleted({ className }: { className?: string }) {
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
      {/* Full-size status icon: Deleted (minus) */}
      <circle cx='12' cy='12' r='9' stroke='#EF4444' strokeWidth='2' />
      <path d='M8 12h8' stroke='#EF4444' strokeWidth='2' />
    </svg>
  )
}
