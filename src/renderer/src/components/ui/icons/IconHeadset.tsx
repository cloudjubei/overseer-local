export function IconHeadset({ className }: { className?: string }) {
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
      {/* Band */}
      <path d="M4 13a8 8 0 0 1 16 0" stroke="#3B82F6" strokeWidth="2" />
      {/* Earcups */}
      <rect x="3" y="12" width="4" height="6" rx="2" stroke="#A855F7" strokeWidth="2" />
      <rect x="17" y="12" width="4" height="6" rx="2" stroke="#10B981" strokeWidth="2" />
      {/* Mic */}
      <path d="M7 17c0 1.657 1.79 3 4 3h2" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}
