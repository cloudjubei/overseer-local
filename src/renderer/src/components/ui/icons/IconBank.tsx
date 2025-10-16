export function IconBank({ className }: { className?: string }) {
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
      <path d="M4 9h16L12 4 4 9z" stroke="#3B82F6" strokeWidth="2" />
      <path d="M6 9v8M10 9v8M14 9v8M18 9v8" stroke="#10B981" strokeWidth="2" />
      <path d="M3 17h18" stroke="#A855F7" strokeWidth="2" />
    </svg>
  )
}
