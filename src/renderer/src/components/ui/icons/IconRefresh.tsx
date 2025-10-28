export function IconRefresh({ className }: { className?: string }) {
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
      <path d="M21 12a9 9 0 1 1-3.3-6.9" stroke="#22C55E" strokeWidth="2" />
      <polyline points="21 3 21 9 15 9" stroke="#EF4444" strokeWidth="2" />
    </svg>
  )
}
