export function IconBricks({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Foundation bricks with warm palette
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
      <rect x="3" y="7" width="6" height="4" stroke="#F59E0B" strokeWidth="2" />
      <rect x="9" y="7" width="6" height="4" stroke="#FB923C" strokeWidth="2" />
      <rect x="15" y="7" width="6" height="4" stroke="#EF4444" strokeWidth="2" />
      <rect x="6" y="13" width="6" height="4" stroke="#A855F7" strokeWidth="2" />
      <rect x="12" y="13" width="6" height="4" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}
