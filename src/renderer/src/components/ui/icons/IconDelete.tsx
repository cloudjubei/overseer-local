export function IconDelete({ className }: { className?: string }) {
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
      <polyline points="3 6 5 6 21 6" stroke="#6366F1" strokeWidth="2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="#EF4444" strokeWidth="2" />
      <path d="M10 11v6" stroke="#A855F7" strokeWidth="2" />
      <path d="M14 11v6" stroke="#A855F7" strokeWidth="2" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}
