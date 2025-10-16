export function IconPercent({ className }: { className?: string }) {
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
      <path d="M5 19L19 5" stroke="#6366F1" strokeWidth="2" />
      <circle cx="7" cy="7" r="2" stroke="#10B981" strokeWidth="2" />
      <circle cx="17" cy="17" r="2" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}
