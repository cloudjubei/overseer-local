export function IconPackage({ className }: { className?: string; filled?: boolean }) {
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
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" stroke="#F59E0B" strokeWidth="2" />
      <path d="M3 8l9 5 9-5" stroke="#A855F7" strokeWidth="2" />
      <path d="M12 13v9" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}
