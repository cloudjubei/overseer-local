export function IconWarningTriangle({ className }: { className?: string }) {
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
      <path
        d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        stroke="#F59E0B"
        strokeWidth="2"
      />
      <line x1="12" y1="9" x2="12" y2="13" stroke="#EF4444" strokeWidth="2" />
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="#EF4444" strokeWidth="2" />
    </svg>
  )
}
