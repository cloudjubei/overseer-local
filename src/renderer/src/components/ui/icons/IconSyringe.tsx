export function IconSyringe({ className }: { className?: string }) {
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
      <path d='M3 7l4 4' stroke='#3B82F6' strokeWidth='2' />
      <path d='M7 3l4 4' stroke='#60A5FA' strokeWidth='2' />
      <rect x='9' y='7' width='8' height='4' rx='1' transform='rotate(45 9 7)' stroke='#6366F1' strokeWidth='2' />
      <path d='M14.5 12.5l3 3' stroke='#06B6D4' strokeWidth='2' />
      <path d='M17 15l3 3' stroke='#22D3EE' strokeWidth='2' />
      <path d='M19 17l2 2' stroke='#10B981' strokeWidth='2' />
    </svg>
  )
}
