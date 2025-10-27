export function IconFastMerge({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* Two source dots */}
      <circle cx="6" cy="8" r="1.5" />
      <circle cx="6" cy="16" r="1.5" />

      {/* Merge curves from two dots into a single path */}
      <path d="M9 8C12 8 12 10 12 12" />
      <path d="M9 16C12 16 12 14 12 12" />

      {/* Fast arrow to the right */}
      <path d="M12 12H18" />
      <path d="M18 12l-3-3" />
      <path d="M18 12l-3 3" />

      {/* Success tick near the arrow */}
      <path d="M14.5 14.5L16 16l4-4" />
    </svg>
  )
}
