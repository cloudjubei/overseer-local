export function IconBrain({ className }: { className?: string; filled?: boolean }) {
  // Reworked: AI/ML brain with gradient-like palette
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
      <path d="M8 6a3 3 0 0 0-3 3v6a3 3 0 1 0 3 3" stroke="#A855F7" strokeWidth="2" />
      <path d="M8 6a3 3 0 1 0 0 6" stroke="#6366F1" strokeWidth="2" />
      <path d="M16 6a3 3 0 0 1 3 3v6a3 3 0 1 1-3 3" stroke="#3B82F6" strokeWidth="2" />
      <path d="M16 6a3 3 0 1 1 0 6" stroke="#22D3EE" strokeWidth="2" />
      <path d="M12 4v16" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
