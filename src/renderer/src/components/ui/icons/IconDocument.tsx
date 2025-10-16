export function IconDocument({ className }: { className?: string; filled?: boolean }) {
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
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
        stroke="#93C5FD"
        strokeWidth="2"
      />
      <path d="M14 2v6h6" stroke="#3B82F6" strokeWidth="2" />
      <path d="M9 13h6" stroke="#22D3EE" strokeWidth="2" />
      <path d="M9 17h6" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}
