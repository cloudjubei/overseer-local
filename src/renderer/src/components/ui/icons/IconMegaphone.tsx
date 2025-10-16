export function IconMegaphone({ className }: { className?: string }) {
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
      {/* Horn */}
      <path d="M3 10l9-4v12l-9-4z" stroke="#3B82F6" strokeWidth="2" />
      {/* Handle */}
      <path d="M12 14l3 5" stroke="#A855F7" strokeWidth="2" />
      {/* Sound lines */}
      <path d="M18 9.5l3 1.5M18 14.5l3-1.5" stroke="#F59E0B" strokeWidth="2" />
      {/* Strap / detail */}
      <path d="M7 9v6" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
