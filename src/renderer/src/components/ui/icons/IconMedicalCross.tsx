export function IconMedicalCross({ className }: { className?: string }) {
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
      <path d='M12 5v14' stroke='#10B981' strokeWidth='2' />
      <path d='M5 12h14' stroke='#10B981' strokeWidth='2' />
      <rect x='4' y='4' width='16' height='16' rx='3' stroke='#3B82F6' strokeWidth='2' />
    </svg>
  )
}
