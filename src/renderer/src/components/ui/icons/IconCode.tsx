export function IconCode({ className }: { className?: string; filled?: boolean }) {
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
      <path d="M8 6L3 12l5 6" stroke="#3B82F6" strokeWidth="2" />
      <path d="M16 6l5 6-5 6" stroke="#A855F7" strokeWidth="2" />
      <path d="M10 20l4-16" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}
