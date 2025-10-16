export function IconTargetDollar({ className }: { className?: string }) {
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
      {/* Target rings */}
      <circle cx="12" cy="12" r="9" stroke="#EF4444" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" stroke="#93C5FD" strokeWidth="2" />
      {/* Dollar */}
      <path d="M12 8v8M9.5 10.5c.5-1 1.5-1.5 2.5-1.5s2 .5 2.5 1.5c.6 1-.1 2-1.5 2.3l-2 .4c-1.4.3-2.1 1.3-1.5 2.3.5 1 1.5 1.5 2.5 1.5 1.1 0 2-.5 2.5-1.5" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
