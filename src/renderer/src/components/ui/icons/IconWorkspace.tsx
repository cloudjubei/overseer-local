export function IconWorkspace({ className }: { className?: string; filled?: boolean }) {
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
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="#6366F1" strokeWidth="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" stroke="#93C5FD" strokeWidth="2" />
      <rect x="3" y="13" width="6" height="8" rx="2" stroke="#10B981" strokeWidth="2" />
      <rect x="11" y="13" width="10" height="8" rx="2" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}
