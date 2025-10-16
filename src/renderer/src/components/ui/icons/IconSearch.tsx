export function IconSearch({ className }: { className?: string; filled?: boolean }) {
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
      <circle cx="11" cy="11" r="7" stroke="#3B82F6" strokeWidth="2" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="#A855F7" strokeWidth="2" />
    </svg>
  )
}
