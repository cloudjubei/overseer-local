export function IconCollection({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="6" width="13" height="13" rx="2" stroke="#06B6D4" strokeWidth="2" />
      <path d="M7 3h10a2 2 0 0 1 2 2v10" stroke="#93C5FD" strokeWidth="2" />
    </svg>
  )
}
