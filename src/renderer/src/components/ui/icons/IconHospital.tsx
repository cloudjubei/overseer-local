export function IconHospital({ className }: { className?: string }) {
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
      <rect x='5' y='4' width='14' height='16' rx='2' stroke='#6366F1' strokeWidth='2' />
      <path d='M12 7v6' stroke='#10B981' strokeWidth='2' />
      <path d='M9 10h6' stroke='#10B981' strokeWidth='2' />
      <path d='M8 20v-3h8v3' stroke='#3B82F6' strokeWidth='2' />
    </svg>
  )
}
