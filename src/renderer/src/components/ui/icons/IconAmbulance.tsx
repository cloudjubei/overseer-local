export function IconAmbulance({ className }: { className?: string }) {
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
      <rect x='3' y='10' width='12' height='7' rx='2' stroke='#3B82F6' strokeWidth='2' />
      <path d='M15 12h3l3 3v2h-3' stroke='#60A5FA' strokeWidth='2' />
      <circle cx='7' cy='19' r='2' stroke='#10B981' strokeWidth='2' />
      <circle cx='16' cy='19' r='2' stroke='#10B981' strokeWidth='2' />
      <path d='M7 13h4' stroke='#EF4444' strokeWidth='2' />
      <path d='M9 11v4' stroke='#EF4444' strokeWidth='2' />
    </svg>
  )
}
