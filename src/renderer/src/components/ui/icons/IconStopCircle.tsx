export function IconStopCircle({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" stroke="#A855F7" strokeWidth="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="#F5000B" strokeWidth="2" />
    </svg>
  )
}
