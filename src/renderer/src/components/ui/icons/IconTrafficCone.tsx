export function IconTrafficCone({ className }: { className?: string; filled?: boolean }) {
  // Road/construction traffic cone
  return (
    <svg
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      className={className}
    >
      {/* Base */}
      <path d='M4 20h16' stroke='#3B82F6' strokeWidth='2' />
      {/* Lower ring */}
      <path d='M7 17h10' stroke='#A855F7' strokeWidth='2' />
      {/* Cone sides */}
      <path d='M9 17l3-10 3 10' stroke='#F59E0B' strokeWidth='2' />
      {/* Stripe */}
      <path d='M10 13h4' stroke='#EF4444' strokeWidth='2' />
    </svg>
  )
}
