import { CSSProperties } from 'react'

export function IconChevron({ className, style }: { className?: string; style?: CSSProperties }) {
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
      <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2"></polyline>
    </svg>
  )
}
