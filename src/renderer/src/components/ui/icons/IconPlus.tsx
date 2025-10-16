export function IconPlus({ className }: { className?: string }) {
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
      <line x1="12" y1="5" x2="12" y2="19" stroke="#3B82F6" strokeWidth="2"></line>
      <line x1="5" y1="12" x2="19" y2="12" stroke="#10B981" strokeWidth="2"></line>
    </svg>
  )
}
