export function IconTerminal({ className }: { className?: string; filled?: boolean }) {
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
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M6 8l3 3-3 3" stroke="#A855F7" strokeWidth="2" />
      <path d="M11 14h7" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
