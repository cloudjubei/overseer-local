export function IconBug({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Bug with red body and blue legs
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
      <rect x="7" y="8" width="10" height="8" rx="4" stroke="#EF4444" strokeWidth="2" />
      <path d="M12 8V4" stroke="#A855F7" strokeWidth="2" />
      <path d="M4 12h4" stroke="#22D3EE" strokeWidth="2" />
      <path d="M16 12h4" stroke="#22D3EE" strokeWidth="2" />
      <path d="M5 9l3 2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M19 9l-3 2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M5 15l3-2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M19 15l-3-2" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}
