export function IconPresentation({ className }: { className?: string }) {
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
      {/* Screen */}
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="#3B82F6" strokeWidth="2" />
      {/* Trend line */}
      <path d="M6 13l4-4 3 2 5-5" stroke="#10B981" strokeWidth="2" />
      {/* Stand */}
      <path d="M9 20l3-4 3 4" stroke="#A855F7" strokeWidth="2" />
      <path d="M12 16v-2" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}
