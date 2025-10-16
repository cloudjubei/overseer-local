export function IconMicroscope({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Research microscope with cool tones
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
      <path d="M6 19h12" stroke="#6366F1" strokeWidth="2" />
      <path d="M9 19a5 5 0 1 1 10 0" stroke="#22D3EE" strokeWidth="2" />
      <rect x="4" y="3" width="6" height="3" rx="1" stroke="#3B82F6" strokeWidth="2" />
      <path d="M7 6v5a4 4 0 0 0 4 4h3" stroke="#06B6D4" strokeWidth="2" />
      <path d="M14 11h4" stroke="#60A5FA" strokeWidth="2" />
    </svg>
  )
}
