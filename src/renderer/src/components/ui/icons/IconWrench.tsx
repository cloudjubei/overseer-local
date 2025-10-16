export function IconWrench({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Pink/Red monkey wrench
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
        d="M21 3a7 7 0 0 1-9.9 9.9L7 17l-3 3 3-7 4.1-4.1A7 7 0 0 1 21 3z"
        stroke="#EF4444"
        strokeWidth="2"
      />
      <circle cx="7" cy="17" r="0.5" fill="#A855F7" stroke="#A855F7" />
    </svg>
  )
}
