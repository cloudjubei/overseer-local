export function IconStretcher({ className }: { className?: string }) {
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
      <path d='M3 10h14a2 2 0 0 1 2 2v2H3v-4z' stroke='#6366F1' strokeWidth='2' />
      <path d='M5 18l4-4' stroke='#60A5FA' strokeWidth='2' />
      <path d='M13 18l-4-4' stroke='#60A5FA' strokeWidth='2' />
      <circle cx='6' cy='19' r='1.5' stroke='#10B981' strokeWidth='2' />
      <circle cx='12' cy='19' r='1.5' stroke='#10B981' strokeWidth='2' />
    </svg>
  )
}
