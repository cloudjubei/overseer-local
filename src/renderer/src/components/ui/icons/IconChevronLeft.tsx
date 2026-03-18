import { CSSProperties } from 'react'

export function IconChevronLeft({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2"></polyline>
    </svg>
  )
}
