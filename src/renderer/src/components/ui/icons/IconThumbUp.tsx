export function IconThumbUp({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
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
        d="M14 9V5a3 3 0 0 0-3-3l-1 5-4 5v8h9a3 3 0 0 0 3-3v-6a2 2 0 0 0-2-2h-2z"
        stroke="#10B981"
        strokeWidth="2"
        fill={filled ? '#10B981' : 'none'}
      />
      <path d="M7 21H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}
