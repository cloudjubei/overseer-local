export function IconShoppingCart({ className }: { className?: string }) {
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
      {/* Basket */}
      <rect x="5" y="7" width="13" height="9" rx="2" stroke="#3B82F6" strokeWidth="2" />
      {/* Handle */}
      <path d="M7 7l3-4M16 7l-3-4" stroke="#A855F7" strokeWidth="2" />
      {/* Wheels */}
      <circle cx="8" cy="19" r="2" stroke="#10B981" strokeWidth="2" />
      <circle cx="17" cy="19" r="2" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}
