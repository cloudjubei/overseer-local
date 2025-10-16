export function IconRocket({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Colorful rocket with flame
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
      <path d="M14 3l7 7-6 6-7-7z" stroke="#6366F1" strokeWidth="2" />
      <path d="M14 3s-4 1-7 4-4 7-4 7l6-2 7-7z" stroke="#3B82F6" strokeWidth="2" />
      <path d="M5 19l3-3" stroke="#FB923C" strokeWidth="2" />
      <path d="M8 22l3-3" stroke="#F59E0B" strokeWidth="2" />
      <circle cx="15" cy="9" r="1.5" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}
