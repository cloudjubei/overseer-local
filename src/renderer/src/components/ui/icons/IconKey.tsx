export function IconKey({ className }: { className?: string; filled?: boolean }) {
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
      <circle cx="8" cy="10" r="3" stroke="#F59E0B" strokeWidth="2" />
      <path d="M11 10h9" stroke="#3B82F6" strokeWidth="2" />
      <path d="M17 10v3" stroke="#A855F7" strokeWidth="2" />
      <path d="M15 10v2" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}
