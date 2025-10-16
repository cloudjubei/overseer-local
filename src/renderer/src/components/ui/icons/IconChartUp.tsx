export function IconChartUp({ className }: { className?: string }) {
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
      <path d="M4 19V5" stroke="#94A3B8" strokeWidth="2" />
      <path d="M4 19h16" stroke="#94A3B8" strokeWidth="2" />
      <polyline points="6 13 11 8 14 11 20 5" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
