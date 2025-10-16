export function IconLightbulb({ className }: { className?: string; filled?: boolean }) {
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
      <path d="M9 18h6" stroke="#FB923C" strokeWidth="2" />
      <path d="M10 22h4" stroke="#FB923C" strokeWidth="2" />
      <path
        d="M12 2a7 7 0 0 0-4 13c1 1 1 2 1 3h6c0-1 0-2 1-3a7 7 0 0 0-4-13z"
        stroke="#F59E0B"
        strokeWidth="2"
      />
    </svg>
  )
}
