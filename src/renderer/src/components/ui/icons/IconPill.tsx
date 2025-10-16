export function IconPill({ className }: { className?: string }) {
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
      <rect x='4' y='8' width='8' height='12' rx='4' transform='rotate(-45 4 8)' stroke='#EF4444' strokeWidth='2' />
      <rect x='12' y='0' width='8' height='12' rx='4' transform='rotate(45 12 0)' stroke='#10B981' strokeWidth='2' />
      <path d='M8 12l4 4' stroke='#F59E0B' strokeWidth='2' />
    </svg>
  )
}
