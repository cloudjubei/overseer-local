export function IconVolleyball({ className }: { className?: string }) {
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
      <path d='M6 9c3 0 6 2 6 5' stroke='#3B82F6' strokeWidth='2' />
      <path d='M18 15c-3 0-6-2-6-5' stroke='#06B6D4' strokeWidth='2' />
      <path d='M12 4c0 4-2 6-6 6' stroke='#10B981' strokeWidth='2' />
      <path d='M12 20c0-4 2-6 6-6' stroke='#22D3EE' strokeWidth='2' />
    </svg>
  )
}
