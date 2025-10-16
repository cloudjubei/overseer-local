export function IconDoubleUp({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 14 12 8 18 14" stroke="#3B82F6" strokeWidth="2" />
      <polyline points="6 20 12 14 18 20" stroke="#6366F1" strokeWidth="2" />
    </svg>
  )
}
