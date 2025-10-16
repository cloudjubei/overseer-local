export function IconInfrastructure({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Construction/infrastructure with colorful columns
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
      <rect x="3" y="10" width="6" height="10" stroke="#F59E0B" strokeWidth="2" />
      <rect x="10.5" y="6" width="6" height="14" stroke="#3B82F6" strokeWidth="2" />
      <rect x="18" y="3" width="3" height="17" stroke="#A855F7" strokeWidth="2" />
      <path d="M3 10l6-4 7-3 5-1" stroke="#60A5FA" strokeWidth="2" />
    </svg>
  )
}
