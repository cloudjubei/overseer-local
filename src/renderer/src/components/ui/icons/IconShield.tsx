export function IconShield({ className }: { className?: string; filled?: boolean }) {
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
      <path d="M12 3l7 3v6c0 4.418-3.582 8-7 8s-7-3.582-7-8V6l7-3z" stroke="#3B82F6" strokeWidth="2" />
      <path d="M12 7v8" stroke="#10B981" strokeWidth="2" />
      <path d="M9 11h6" stroke="#A855F7" strokeWidth="2" />
    </svg>
  )
}
