export function IconList({ className }: { className?: string }) {
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
      <line x1="8" y1="6" x2="20" y2="6" stroke="#60A5FA" strokeWidth="2" />
      <line x1="8" y1="12" x2="20" y2="12" stroke="#A855F7" strokeWidth="2" />
      <line x1="8" y1="18" x2="20" y2="18" stroke="#10B981" strokeWidth="2" />
      <circle cx="4" cy="6" r="1.5" fill="#F59E0B" />
      <circle cx="4" cy="12" r="1.5" fill="#EF4444" />
      <circle cx="4" cy="18" r="1.5" fill="#22D3EE" />
    </svg>
  )
}
