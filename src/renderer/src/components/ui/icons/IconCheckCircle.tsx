export function IconCheckCircle({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" stroke="#10B981" strokeWidth="2" />
      <path d="M8 12l3 3 5-5" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
