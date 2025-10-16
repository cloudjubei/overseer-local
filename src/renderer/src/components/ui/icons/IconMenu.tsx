export function IconMenu({ className }: { className?: string }) {
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
      <line x1="3" y1="6" x2="21" y2="6" stroke="#3B82F6" strokeWidth="2" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="#A855F7" strokeWidth="2" />
      <line x1="3" y1="18" x2="21" y2="18" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
