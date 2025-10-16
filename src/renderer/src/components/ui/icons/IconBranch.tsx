export function IconBranch({ className }: { className?: string; filled?: boolean }) {
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
      <circle cx="17" cy="16" r="2" stroke="#A855F7" strokeWidth="2" />
      <path d="M7 8v4c0 2 2 4 4 4h6" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}
