export function IconThermometer({ className }: { className?: string }) {
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
      <path d='M11 5a2 2 0 0 1 4 0v7.17a4 4 0 1 1-4 0V5z' stroke='#06B6D4' strokeWidth='2' />
      <path d='M13 10v6' stroke='#22D3EE' strokeWidth='2' />
      <circle cx='13' cy='18' r='1.5' stroke='#EF4444' strokeWidth='2' />
    </svg>
  )
}
