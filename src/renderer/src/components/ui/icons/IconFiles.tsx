export function IconFiles({ className }: { className?: string }) {
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
        d="M14 2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 4 2h8a2 2 0 0 0 2-2V7z"
        stroke="#6366F1"
        strokeWidth="2"
      />
      <path d="M12 2v5h5" stroke="#93C5FD" strokeWidth="2" />
      <path d="M8 12h6" stroke="#60A5FA" strokeWidth="2" />
      <path d="M8 16h6" stroke="#60A5FA" strokeWidth="2" />
    </svg>
  )
}
