export function IconFastMerge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Two source dots */}
      <circle cx="6" cy="8" r="2" />
      <circle cx="6" cy="16" r="2" />

      {/* Merge curves from two dots into a single path */}
      <path d="M9 8c3 0 3 2 3 4" />
      <path d="M9 16c3 0 3-2 3-4" />

      {/* Fast arrow to the right */}
      <path d="M12 12h6" />
      <path d="M18 12l-3-3" />
      <path d="M18 12l-3 3" />

      {/* Success tick near the arrow */}
      <path d="M14.5 14.5L16 16l4-4" />
    </svg>
  )
}
