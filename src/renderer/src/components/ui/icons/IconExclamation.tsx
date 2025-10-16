export function IconExclamation({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" stroke="#F59E0B" strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="12" stroke="#EF4444" strokeWidth="2" />
      <line x1="12" y1="16" x2="12.01" y2="16" stroke="#EF4444" strokeWidth="2" />
    </svg>
  )
}
