export function IconLoader({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" stroke="#93C5FD" strokeWidth="2" opacity="0.35" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="#6366F1" strokeWidth="2" />
    </svg>
  )
}
