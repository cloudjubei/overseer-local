export function IconTennis({ className }: { className?: string }) {
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
      <circle cx='12' cy='12' r='8' stroke='#6366F1' strokeWidth='2' />
      <path d='M7 7c2 1.5 2 8.5 0 10' stroke='#3B82F6' strokeWidth='2' />
      <path d='M17 7c-2 1.5-2 8.5 0 10' stroke='#06B6D4' strokeWidth='2' />
    </svg>
  )
}
