export function IconRunner({ className }: { className?: string }) {
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
      <circle cx='8' cy='6' r='2' stroke='#6366F1' strokeWidth='2' />
      <path d='M10 8l3 2' stroke='#3B82F6' strokeWidth='2' />
      <path d='M9 12l3-2 3 2' stroke='#06B6D4' strokeWidth='2' />
      <path d='M9 12l-2 4' stroke='#10B981' strokeWidth='2' />
      <path d='M12 14l3 4' stroke='#22D3EE' strokeWidth='2' />
    </svg>
  )
}
