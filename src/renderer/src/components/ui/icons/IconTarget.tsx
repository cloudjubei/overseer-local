export function IconTarget({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="11" stroke="#EF4444" strokeWidth="2" />
      <circle cx="12" cy="12" r="10" stroke="#FFFFFF" strokeWidth="1" />
      <circle cx="12" cy="12" r="8" stroke="#EF4444" strokeWidth="2" />
      <circle cx="12" cy="12" r="7" stroke="#FFFFFF" strokeWidth="1" />
      <circle cx="12" cy="12" r="5" stroke="#EF4444" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="12" cy="12" r="1" fill="#EF4444" stroke="#EF4444" strokeWidth="2" />
    </svg>
  )
}
