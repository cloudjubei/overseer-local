export function IconGlobe({ className }: { className?: string; filled?: boolean }) {
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
      <circle cx="12" cy="12" r="9" stroke="#22D3EE" strokeWidth="2" />
      <path d="M3 12h18" stroke="#3B82F6" strokeWidth="2" />
      <path d="M12 3a15 15 0 0 0 0 18a15 15 0 0 0 0-18z" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}
