export function IconHourglass({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 2v6c0 2.2 1.8 4 4 4h4c2.2 0 4-1.8 4-4V2" />
      <path d="M6 12v6c0 2.2 1.8 4 4 4h4c2.2 0 4-1.8 4-4v-6" />
      <path d="M6 6h12" />
      <path d="M6 18h12" />
    </svg>
  )
}
