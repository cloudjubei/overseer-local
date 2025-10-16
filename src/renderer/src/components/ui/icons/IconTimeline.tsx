export function IconTimeline({ className }: { className?: string }) {
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
      <line x1="12" y1="3" x2="12" y2="21" stroke="#6366F1" strokeWidth="2" />
      <circle cx="12" cy="6" r="2" stroke="#F59E0B" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" stroke="#3B82F6" strokeWidth="2" />
      <circle cx="12" cy="18" r="2" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
