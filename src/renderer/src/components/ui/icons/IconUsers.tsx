export function IconUsers({ className }: { className?: string }) {
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
      {/* Primary user head */}
      <circle cx="9" cy="8" r="3" stroke="#3B82F6" strokeWidth="2" />
      {/* Secondary user head */}
      <circle cx="16" cy="9" r="2.5" stroke="#A855F7" strokeWidth="2" />
      {/* Primary shoulders */}
      <path d="M3.5 18a5.5 5.5 0 0 1 11 0" stroke="#10B981" strokeWidth="2" />
      {/* Secondary shoulders */}
      <path d="M11.5 17a4.5 4.5 0 0 1 8 2" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}
