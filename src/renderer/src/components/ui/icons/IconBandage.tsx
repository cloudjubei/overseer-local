export function IconBandage({ className }: { className?: string }) {
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
      <rect x='4' y='8' width='16' height='6' rx='3' transform='rotate(45 12 11)' stroke='#F59E0B' strokeWidth='2' />
      <circle cx='10' cy='10' r='0.8' transform='rotate(45 10 10)' stroke='#3B82F6' strokeWidth='2' />
      <circle cx='12' cy='12' r='0.8' transform='rotate(45 12 12)' stroke='#3B82F6' strokeWidth='2' />
      <circle cx='14' cy='14' r='0.8' transform='rotate(45 14 14)' stroke='#3B82F6' strokeWidth='2' />
    </svg>
  )
}
