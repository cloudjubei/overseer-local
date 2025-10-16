export function IconMobile({ className }: { className?: string; filled?: boolean }) {
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
      <rect x="7" y="2" width="10" height="20" rx="2" stroke="#3B82F6" strokeWidth="2" />
      <circle cx="12" cy="18" r="1" fill="#10B981" stroke="#10B981" />
    </svg>
  )
}
