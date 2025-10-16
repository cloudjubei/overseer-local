export function IconPieChart({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" stroke="#3B82F6" strokeWidth="2" />
      <path d="M12 3v9l7 7" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
