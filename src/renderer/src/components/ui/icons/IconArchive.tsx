export function IconArchive({ className }: { className?: string; filled?: boolean }) {
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
      <rect x="3" y="3" width="18" height="4" rx="1" stroke="#A855F7" strokeWidth="2" />
      <rect x="5" y="7" width="14" height="14" rx="2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M9 12h6" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
