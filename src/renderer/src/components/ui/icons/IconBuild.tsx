export function IconBuild({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Hammer and wrench with distinct colors
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
      {/* Wrench */}
      <path d="M14.7 6.3l3 3L7 20H4v-3z" stroke="#3B82F6" strokeWidth="2" />
      {/* Hammer handle */}
      <path d="M13 5l6 6" stroke="#F59E0B" strokeWidth="2" />
      {/* Hammer head / accent */}
      <path d="M2 22l2-5 3 3-5 2z" stroke="#A855F7" strokeWidth="2" />
    </svg>
  )
}
