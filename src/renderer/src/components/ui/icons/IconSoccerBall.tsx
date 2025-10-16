export function IconSoccerBall({ className }: { className?: string }) {
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
      <circle cx='12' cy='12' r='8' stroke='#3B82F6' strokeWidth='2' />
      <polygon points='12,8 9,10 10,13 14,13 15,10' stroke='#6366F1' strokeWidth='2' fill='none' />
      <path d='M9 10L6.5 8.5' stroke='#06B6D4' strokeWidth='2' />
      <path d='M15 10L17.5 8.5' stroke='#06B6D4' strokeWidth='2' />
      <path d='M10 13l-1.5 3' stroke='#10B981' strokeWidth='2' />
      <path d='M14 13l1.5 3' stroke='#10B981' strokeWidth='2' />
    </svg>
  )
}
