export function IconPiggyBank({ className }: { className?: string }) {
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
      <path d="M5 13c0-3 3-5 7-5s7 2 7 5-3 5-7 5-7-2-7-5z" stroke="#F59E0B" strokeWidth="2" />
      <path d="M19 13h2" stroke="#A855F7" strokeWidth="2" />
      <circle cx="9.5" cy="12" r="1" stroke="#3B82F6" strokeWidth="2" />
      <path d="M7 18l-1 2" stroke="#10B981" strokeWidth="2" />
      <path d="M13 18l1 2" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
