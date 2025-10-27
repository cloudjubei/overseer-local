export function IconFastMerge({ className }: { className?: string }) {
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
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Two source dots (blue and purple, like IconMerge) */}
      <circle cx="6" cy="8" r="2" stroke="#3B82F6" strokeWidth="2" />
      <circle cx="6" cy="16" r="2" stroke="#A855F7" strokeWidth="2" />

      {/* Merge curves (teal/cyan accent) */}
      <path d="M9 8c3 0 3 2 3 4" stroke="#22D3EE" strokeWidth="2" />
      <path d="M9 16c3 0 3-2 3-4" stroke="#22D3EE" strokeWidth="2" />

      {/* Fast arrow to the right (brand-ish blue) */}
      <path d="M12 12h6" stroke="#3B82F6" strokeWidth="2" />
      <path d="M18 12l-3-3" stroke="#3B82F6" strokeWidth="2" />
      <path d="M18 12l-3 3" stroke="#3B82F6" strokeWidth="2" />

      {/* Success tick (green, consistent with check icons) */}
      <path d="M14.5 14.5L16 16l4-4" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
