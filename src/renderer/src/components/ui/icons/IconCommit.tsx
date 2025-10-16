export function IconCommit({ className }: { className?: string; filled?: boolean }) {
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
      <line x1="3" y1="12" x2="9" y2="12" stroke="#3B82F6" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="#A855F7" strokeWidth="2" />
      <line x1="15" y1="12" x2="21" y2="12" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}
