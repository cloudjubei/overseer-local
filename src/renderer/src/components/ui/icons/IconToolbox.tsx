export function IconToolbox({ className }: { className?: string; filled?: boolean }) {
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
      <rect x="3" y="8" width="18" height="11" rx="2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" stroke="#A855F7" strokeWidth="2" />
      <path d="M3 13h18" stroke="#10B981" strokeWidth="2" />
      <path d="M10 13v3" stroke="#F59E0B" strokeWidth="2" />
      <path d="M14 13v3" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}
