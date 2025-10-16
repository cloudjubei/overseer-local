export function IconTestTube({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Neon green/blue testing tube
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
      <path d="M9 3h6" stroke="#22D3EE" strokeWidth="2" />
      <path d="M10 3v8a6 6 0 1 0 4 0V3" stroke="#10B981" strokeWidth="2" />
      <path d="M8 11h8" stroke="#60A5FA" strokeWidth="2" />
      <circle cx="12" cy="15" r="1" fill="#22D3EE" />
      <circle cx="14.5" cy="18" r="1.2" fill="#10B981" />
    </svg>
  )
}
