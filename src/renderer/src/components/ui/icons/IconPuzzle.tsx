export function IconPuzzle({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Components puzzle outline with accent
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
        d="M10 3h4a2 2 0 0 1 2 2v3h3a2 2 0 0 1 2 2v4h-3a2 2 0 0 0-2 2v3h-4a2 2 0 0 1-2-2v-3H5a2 2 0 0 1-2-2v-4h3a2 2 0 0 0 2-2z"
        stroke="#6366F1"
        strokeWidth="2"
      />
      <path d="M12 6a2 2 0 1 0 0 4" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}
