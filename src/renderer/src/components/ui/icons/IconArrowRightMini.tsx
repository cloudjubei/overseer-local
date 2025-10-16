export function IconArrowRightMini({ className }: { className?: string; filled?: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="10 6 16 12 10 18" stroke="#6366F1" strokeWidth="2" />
    </svg>
  )
}
