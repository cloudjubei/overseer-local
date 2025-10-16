export function IconBoard({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#A855F7" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="10" rx="1.5" stroke="#3B82F6" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#10B981" strokeWidth="2" />
      <rect x="14" y="15" width="7" height="6" rx="1.5" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}
