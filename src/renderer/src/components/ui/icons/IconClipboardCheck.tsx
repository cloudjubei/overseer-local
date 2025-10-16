export function IconClipboardCheck({ className }: { className?: string }) {
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
      {/* Clipboard */}
      <rect x="6" y="5" width="12" height="16" rx="2" stroke="#3B82F6" strokeWidth="2" />
      {/* Clip */}
      <rect x="9" y="2" width="6" height="4" rx="1" stroke="#A855F7" strokeWidth="2" />
      {/* Checkmark */}
      <path d="M9 13l2 2 4-4" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
