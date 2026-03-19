import React from 'react'

export function IconFileBadge({
  badgeText,
  fill,
  stroke,
  textColor,
  className,
  size = 20,
}: {
  badgeText?: string
  fill: string
  stroke: string
  textColor?: string
  className?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="18" rx="2" fill={fill} stroke={stroke} />
      {badgeText && (
        <text
          x="12"
          y="16"
          textAnchor="middle"
          fontSize={badgeText.length > 2 ? '8' : '9'}
          fill={textColor}
          fontFamily="monospace"
        >
          {badgeText}
        </text>
      )}
    </svg>
  )
}

export function IconFileJson({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#ecf7ff" stroke="#8ed0ff" />
      <path
        d="M9 9c-2 0-2 6 0 6M15 9c2 0 2 6 0 6"
        stroke="#1c7ed6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconFileImage({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#ecfdf5" stroke="#b2f2bb" />
      <path d="M6 17l4-5 3 4 2-3 3 4H6z" fill="#40c057" />
      <circle cx="9" cy="9" r="1.5" fill="#37b24d" />
    </svg>
  )
}

export function IconFileZip({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#fff9db" stroke="#ffe8a1" />
      <path d="M12 6v12M12 6h2M12 9h2M12 12h2M12 15h2" stroke="#e67700" strokeWidth="1.5" />
    </svg>
  )
}

export function IconFileText({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#f8f9fa" stroke="#dee2e6" />
      <path
        d="M6 8h10M6 11h10M6 14h8"
        stroke="#495057"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconFileDefault({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="2"
        fill="var(--surface-2, #f5f6f8)"
        stroke="var(--border-subtle, #d9dbe1)"
      />
      <path
        d="M8 8h8M8 12h8M8 16h6"
        stroke="var(--text-muted)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}
