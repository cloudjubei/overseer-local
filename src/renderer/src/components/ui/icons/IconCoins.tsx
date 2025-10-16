export function IconCoins({ className }: { className?: string }) {
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
      <ellipse cx="8" cy="8" rx="5" ry="3" stroke="#F59E0B" strokeWidth="2" />
      <path d="M3 8v5c0 1.7 2.2 3 5 3s5-1.3 5-3V8" stroke="#F59E0B" strokeWidth="2" />
      <ellipse cx="15.5" cy="14" rx="4.5" ry="2.5" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
