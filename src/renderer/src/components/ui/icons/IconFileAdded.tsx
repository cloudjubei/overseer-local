export function IconFileAdded({ className }: { className?: string }) {
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
      {/* Document */}
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" stroke="#93C5FD" strokeWidth="2" />
      <path d="M14 2v6h6" stroke="#3B82F6" strokeWidth="2" />
      {/* Plus badge */}
      <circle cx="18" cy="18" r="3.5" stroke="#10B981" strokeWidth="2" />
      <path d="M18 16.5v3" stroke="#10B981" strokeWidth="2" />
      <path d="M16.5 18h3" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
