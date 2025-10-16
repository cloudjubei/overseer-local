export function IconFunction({ className }: { className?: string; filled?: boolean }) {
  // Depicts a function mapping: left circle -> arrow -> right circle
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
      <circle cx="6" cy="12" r="3" stroke="#22D3EE" strokeWidth="2" />
      <circle cx="18" cy="12" r="3" stroke="#10B981" strokeWidth="2" />
      <path d="M9 12h6" stroke="#A855F7" strokeWidth="2" />
      <path d="M13 9l3 3-3 3" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}
