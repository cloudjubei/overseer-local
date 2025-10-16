export function IconServer({ className }: { className?: string; filled?: boolean }) {
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
      <rect x="4" y="4" width="16" height="6" rx="2" stroke="#3B82F6" strokeWidth="2" />
      <rect x="4" y="14" width="16" height="6" rx="2" stroke="#6366F1" strokeWidth="2" />
      <circle cx="7" cy="7" r="1" fill="#10B981" />
      <circle cx="10" cy="7" r="1" fill="#F59E0B" />
      <circle cx="7" cy="17" r="1" fill="#10B981" />
      <circle cx="10" cy="17" r="1" fill="#EF4444" />
      <path d="M14 7h5" stroke="#22D3EE" strokeWidth="2" />
      <path d="M14 17h5" stroke="#A855F7" strokeWidth="2" />
    </svg>
  )
}
