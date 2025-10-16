export function IconRobot({ className }: { className?: string }) {
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
      <rect x="4" y="7" width="16" height="12" rx="3" stroke="#A855F7" strokeWidth="2" />
      <circle cx="9" cy="13" r="1.5" stroke="#F59E0B" strokeWidth="2" />
      <circle cx="15" cy="13" r="1.5" stroke="#F59E0B" strokeWidth="2" />
      <path d="M12 3v3" stroke="#EF4444" strokeWidth="2" />
      <rect x="10" y="3" width="4" height="2" rx="1" stroke="#EF4444" strokeWidth="2" />
    </svg>
  )
}
