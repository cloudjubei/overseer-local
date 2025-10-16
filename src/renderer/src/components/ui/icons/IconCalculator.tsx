export function IconCalculator({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="#3B82F6" strokeWidth="2" />
      <rect x="8" y="7" width="8" height="3" rx="1" stroke="#A855F7" strokeWidth="2" />
      <path d="M8 13h2M12 13h2M16 13h0M8 16h2M12 16h2M16 16h0" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
