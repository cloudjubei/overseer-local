export function IconBasketball({ className }: { className?: string }) {
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
      <path d='M4 12h16' stroke='#3B82F6' strokeWidth='2' />
      <path d='M12 4v16' stroke='#06B6D4' strokeWidth='2' />
      <path d='M6 6c3 2.5 9 2.5 12 0' stroke='#10B981' strokeWidth='2' />
      <path d='M6 18c3-2.5 9-2.5 12 0' stroke='#22D3EE' strokeWidth='2' />
    </svg>
  )
}
