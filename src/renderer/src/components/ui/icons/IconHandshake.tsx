export function IconHandshake({ className }: { className?: string }) {
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
      {/* Left sleeve */}
      <path d="M2 10l4-4 3 3-4 4" stroke="#3B82F6" strokeWidth="2" />
      {/* Right sleeve */}
      <path d="M22 10l-4-4-3 3 4 4" stroke="#A855F7" strokeWidth="2" />
      {/* Handshake overlap */}
      <path d="M7 13l3 3a2 2 0 0 0 2 0l5-5" stroke="#10B981" strokeWidth="2" />
      {/* Fingers detail */}
      <path d="M10 16l1.5 1.5M12 15.5L13.5 17M14 14.5L15.5 16" stroke="#F59E0B" strokeWidth="1.5" />
    </svg>
  )
}
