export function IconCapsule({ className }: { className?: string }) {
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
      <rect x='5' y='5' width='8' height='14' rx='4' transform='rotate(-45 5 5)' stroke='#10B981' strokeWidth='2' />
      <rect x='11' y='-1' width='8' height='14' rx='4' transform='rotate(45 11 -1)' stroke='#3B82F6' strokeWidth='2' />
    </svg>
  )
}
