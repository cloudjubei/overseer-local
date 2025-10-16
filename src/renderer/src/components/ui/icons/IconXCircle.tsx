export function IconXCircle({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2" />
      <line x1="9" y1="9" x2="15" y2="15" stroke="#EF4444" strokeWidth="2" />
      <line x1="15" y1="9" x2="9" y2="15" stroke="#EF4444" strokeWidth="2" />
    </svg>
  )
}
