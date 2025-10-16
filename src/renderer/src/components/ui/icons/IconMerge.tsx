export function IconMerge({ className }: { className?: string; filled?: boolean }) {
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
      <circle cx="7" cy="6" r="2" stroke="#3B82F6" strokeWidth="2" />
      <circle cx="7" cy="18" r="2" stroke="#A855F7" strokeWidth="2" />
      <circle cx="17" cy="12" r="2" stroke="#10B981" strokeWidth="2" />
      <path d="M9 6c4 0 6 3 6 6s-2 6-6 6" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}
