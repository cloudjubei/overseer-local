export function IconClamp({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Compression clamp with distinct colors
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
      <rect x="5" y="2" width="14" height="4" rx="1" stroke="#A855F7" strokeWidth="2" />
      <path d="M7 6v6a3 3 0 0 0 3 3h4v4H9" stroke="#3B82F6" strokeWidth="2" />
      <path d="M17 10H10" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
