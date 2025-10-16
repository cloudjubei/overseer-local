export * from './IconBack'
export * from './IconChevron'
export * from './IconDelete'
export * from './IconEdit'
export * from './IconError'
export * from './IconExclamation'
export * from './IconPlay'
export * from './IconPlus'

export function IconList({ className }: { className?: string }) {
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
      <line x1="8" y1="6" x2="20" y2="6" stroke="#60A5FA" strokeWidth="2" />
      <line x1="8" y1="12" x2="20" y2="12" stroke="#A855F7" strokeWidth="2" />
      <line x1="8" y1="18" x2="20" y2="18" stroke="#10B981" strokeWidth="2" />
      <circle cx="4" cy="6" r="1.5" fill="#F59E0B" />
      <circle cx="4" cy="12" r="1.5" fill="#EF4444" />
      <circle cx="4" cy="18" r="1.5" fill="#22D3EE" />
    </svg>
  )
}

export function IconBoard({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#A855F7" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="10" rx="1.5" stroke="#3B82F6" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#10B981" strokeWidth="2" />
      <rect x="14" y="15" width="7" height="6" rx="1.5" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}

export function IconCheckCircle({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" stroke="#10B981" strokeWidth="2" />
      <path d="M8 12l3 3 5-5" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}

export function IconXCircle({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2" />
      <line x1="9" y1="9" x2="15" y2="15" stroke="#EF4444" strokeWidth="2" />
      <line x1="15" y1="9" x2="9" y2="15" stroke="#EF4444" strokeWidth="2" />
    </svg>
  )
}

export function IconStopCircle({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" stroke="#A855F7" strokeWidth="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="#F5000B" strokeWidth="2" />
    </svg>
  )
}

export function IconLoader({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" stroke="#93C5FD" strokeWidth="2" opacity="0.35" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="#6366F1" strokeWidth="2" />
    </svg>
  )
}

// Small arrow icons for token chip
export function IconArrowLeftMini({ className }: { className?: string; filled?: boolean }) {
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
      <polyline points="14 18 8 12 14 6" stroke="#6366F1" strokeWidth="2" />
    </svg>
  )
}

export function IconArrowRightMini({ className }: { className?: string; filled?: boolean }) {
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
      <polyline points="10 6 16 12 10 18" stroke="#6366F1" strokeWidth="2" />
    </svg>
  )
}

// New: Thumbs Up/Down icons with outlined and filled variants
export function IconThumbUp({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
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
      <path
        d="M14 9V5a3 3 0 0 0-3-3l-1 5-4 5v8h9a3 3 0 0 0 3-3v-6a2 2 0 0 0-2-2h-2z"
        stroke="#10B981"
        strokeWidth="2"
        fill={filled ? '#10B981' : 'none'}
      />
      <path d="M7 21H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}

export function IconThumbDown({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
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
      <path
        d="M10 15v4a3 3 0 0 0 3 3l1-5 4-5V4H9A3 3 0 0 0 6 7v6a2 2 0 0 0 2 2h2z"
        stroke="#EF4444"
        strokeWidth="2"
        fill={filled ? '#EF4444' : 'none'}
      />
      <path d="M17 3h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}

export function IconHome({ className }: { className?: string }) {
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
      <path d="M3 11l9-7 9 7" stroke="#F59E0B" strokeWidth="2" />
      <path d="M5 10.5V21h14V10.5" stroke="#3B82F6" strokeWidth="2" />
      <path d="M9 21v-6h6v6" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}

export function IconFiles({ className }: { className?: string }) {
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
      <path
        d="M14 2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 4 2h8a2 2 0 0 0 2-2V7z"
        stroke="#6366F1"
        strokeWidth="2"
      />
      <path d="M12 2v5h5" stroke="#93C5FD" strokeWidth="2" />
      <path d="M8 12h6" stroke="#60A5FA" strokeWidth="2" />
      <path d="M8 16h6" stroke="#60A5FA" strokeWidth="2" />
    </svg>
  )
}

export function IconChat({ className }: { className?: string }) {
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
      <path
        d="M21 15a4 4 0 0 1-4 4H8l-5 3V6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"
        stroke="#14B8A6"
        strokeWidth="2"
      />
      <path d="M8 9h8" stroke="#22D3EE" strokeWidth="2" />
      <path d="M8 13h5" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}

export function IconRobot({ className }: { className?: string }) {
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
      <rect x="4" y="7" width="16" height="12" rx="3" stroke="#A855F7" strokeWidth="2" />
      <circle cx="9" cy="13" r="1.5" stroke="#F59E0B" strokeWidth="2" />
      <circle cx="15" cy="13" r="1.5" stroke="#F59E0B" strokeWidth="2" />
      <path d="M12 3v3" stroke="#EF4444" strokeWidth="2" />
      <rect x="10" y="3" width="4" height="2" rx="1" stroke="#EF4444" strokeWidth="2" />
    </svg>
  )
}

export function IconTimeline({ className }: { className?: string }) {
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
      <line x1="12" y1="3" x2="12" y2="21" stroke="#6366F1" strokeWidth="2" />
      <circle cx="12" cy="6" r="2" stroke="#F59E0B" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" stroke="#3B82F6" strokeWidth="2" />
      <circle cx="12" cy="18" r="2" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}
export function IconAntenna({ className }: { className?: string }) {
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
      <circle cx="12" cy="7" r="2" stroke="#F59E0B" strokeWidth="2" />
      <path d="M12 9v12" stroke="#10B981" strokeWidth="2" />
      <path d="M8 13a6 6 0 0 1 8 0" stroke="#3B82F6" strokeWidth="2" />
      <path d="M5.5 10.5a9 9 0 0 1 13 0" stroke="#60A5FA" strokeWidth="2" />
    </svg>
  )
}

export function IconBell({ className }: { className?: string }) {
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
      <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" stroke="#F59E0B" strokeWidth="2" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#FB923C" strokeWidth="2" />
    </svg>
  )
}

export function IconSettings({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="3" stroke="#3B82F6" strokeWidth="2" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9A1.65 1.65 0 0 0 10 3V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.26 1.3.73 1.77.47.47 1.11.73 1.77.73a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="#A855F7"
        strokeWidth="2"
      />
    </svg>
  )
}

export function IconFolder({ className }: { className?: string }) {
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
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        stroke="#F59E0B"
        strokeWidth="2"
      />
    </svg>
  )
}

// New: Open folder icon to match closed folder above
export function IconFolderOpen({ className }: { className?: string }) {
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
      <path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1" stroke="#F59E0B" strokeWidth="2" />
      <path
        d="M3 10h17a2 2 0 0 1 1.94 2.47l-1.2 4.2A2 2 0 0 1 18.8 18H6.2a2 2 0 0 1-1.94-1.33L2.5 12.5A2 2 0 0 1 3 10z"
        stroke="#FB923C"
        strokeWidth="2"
      />
    </svg>
  )
}

export function IconWorkspace({ className }: { className?: string; filled?: boolean }) {
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
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="#6366F1" strokeWidth="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" stroke="#93C5FD" strokeWidth="2" />
      <rect x="3" y="13" width="6" height="8" rx="2" stroke="#10B981" strokeWidth="2" />
      <rect x="11" y="13" width="10" height="8" rx="2" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}

export function IconWarningTriangle({ className }: { className?: string }) {
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
      <path
        d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        stroke="#F59E0B"
        strokeWidth="2"
      />
      <line x1="12" y1="9" x2="12" y2="13" stroke="#EF4444" strokeWidth="2" />
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="#EF4444" strokeWidth="2" />
    </svg>
  )
}

export function IconMenu({ className }: { className?: string }) {
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
      <line x1="3" y1="6" x2="21" y2="6" stroke="#3B82F6" strokeWidth="2" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="#A855F7" strokeWidth="2" />
      <line x1="3" y1="18" x2="21" y2="18" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}

export function IconCollection({ className }: { className?: string }) {
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
      <rect x="3" y="6" width="13" height="13" rx="2" stroke="#06B6D4" strokeWidth="2" />
      <path d="M7 3h10a2 2 0 0 1 2 2v10" stroke="#93C5FD" strokeWidth="2" />
    </svg>
  )
}

export function IconTestTube({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Neon green/blue testing tube
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
      <path d="M9 3h6" stroke="#22D3EE" strokeWidth="2" />
      <path d="M10 3v8a6 6 0 1 0 4 0V3" stroke="#10B981" strokeWidth="2" />
      <path d="M8 11h8" stroke="#60A5FA" strokeWidth="2" />
      <circle cx="12" cy="15" r="1" fill="#22D3EE" />
      <circle cx="14.5" cy="18" r="1.2" fill="#10B981" />
    </svg>
  )
}

export function IconWrench({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Pink/Red monkey wrench
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
      <path
        d="M21 3a7 7 0 0 1-9.9 9.9L7 17l-3 3 3-7 4.1-4.1A7 7 0 0 1 21 3z"
        stroke="#EF4444"
        strokeWidth="2"
      />
      <circle cx="7" cy="17" r="0.5" fill="#A855F7" stroke="#A855F7" />
    </svg>
  )
}

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

export function IconToolbox({ className }: { className?: string; filled?: boolean }) {
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
      <rect x="3" y="8" width="18" height="11" rx="2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" stroke="#A855F7" strokeWidth="2" />
      <path d="M3 13h18" stroke="#10B981" strokeWidth="2" />
      <path d="M10 13v3" stroke="#F59E0B" strokeWidth="2" />
      <path d="M14 13v3" stroke="#F59E0B" strokeWidth="2" />
    </svg>
  )
}

export function IconInfrastructure({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Construction/infrastructure with colorful columns
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
      <rect x="3" y="10" width="6" height="10" stroke="#F59E0B" strokeWidth="2" />
      <rect x="10.5" y="6" width="6" height="14" stroke="#3B82F6" strokeWidth="2" />
      <rect x="18" y="3" width="3" height="17" stroke="#A855F7" strokeWidth="2" />
      <path d="M3 10l6-4 7-3 5-1" stroke="#60A5FA" strokeWidth="2" />
    </svg>
  )
}

export function IconBrain({ className }: { className?: string; filled?: boolean }) {
  // Reworked: AI/ML brain with gradient-like palette
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
      <path d="M8 6a3 3 0 0 0-3 3v6a3 3 0 1 0 3 3" stroke="#A855F7" strokeWidth="2" />
      <path d="M8 6a3 3 0 1 0 0 6" stroke="#6366F1" strokeWidth="2" />
      <path d="M16 6a3 3 0 0 1 3 3v6a3 3 0 1 1-3 3" stroke="#3B82F6" strokeWidth="2" />
      <path d="M16 6a3 3 0 1 1 0 6" stroke="#22D3EE" strokeWidth="2" />
      <path d="M12 4v16" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}

export function IconDocument({ className }: { className?: string; filled?: boolean }) {
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
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
        stroke="#93C5FD"
        strokeWidth="2"
      />
      <path d="M14 2v6h6" stroke="#3B82F6" strokeWidth="2" />
      <path d="M9 13h6" stroke="#22D3EE" strokeWidth="2" />
      <path d="M9 17h6" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}

export function IconTarget({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="11" stroke="#EF4444" strokeWidth="2" />
      <circle cx="12" cy="12" r="10" stroke="#FFFFFF" strokeWidth="1" />
      <circle cx="12" cy="12" r="8" stroke="#EF4444" strokeWidth="2" />
      <circle cx="12" cy="12" r="7" stroke="#FFFFFF" strokeWidth="1" />
      <circle cx="12" cy="12" r="5" stroke="#EF4444" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="12" cy="12" r="1" fill="#EF4444" stroke="#EF4444" strokeWidth="2" />
    </svg>
  )
}

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

export function IconBug({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Bug with red body and blue legs
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
      <rect x="7" y="8" width="10" height="8" rx="4" stroke="#EF4444" strokeWidth="2" />
      <path d="M12 8V4" stroke="#A855F7" strokeWidth="2" />
      <path d="M4 12h4" stroke="#22D3EE" strokeWidth="2" />
      <path d="M16 12h4" stroke="#22D3EE" strokeWidth="2" />
      <path d="M5 9l3 2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M19 9l-3 2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M5 15l3-2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M19 15l-3-2" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}

export function IconPackage({ className }: { className?: string; filled?: boolean }) {
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
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" stroke="#F59E0B" strokeWidth="2" />
      <path d="M3 8l9 5 9-5" stroke="#A855F7" strokeWidth="2" />
      <path d="M12 13v9" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}

export function IconSearch({ className }: { className?: string; filled?: boolean }) {
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
      <circle cx="11" cy="11" r="7" stroke="#3B82F6" strokeWidth="2" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="#A855F7" strokeWidth="2" />
    </svg>
  )
}

export function IconLightbulb({ className }: { className?: string; filled?: boolean }) {
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
      <path d="M9 18h6" stroke="#FB923C" strokeWidth="2" />
      <path d="M10 22h4" stroke="#FB923C" strokeWidth="2" />
      <path
        d="M12 2a7 7 0 0 0-4 13c1 1 1 2 1 3h6c0-1 0-2 1-3a7 7 0 0 0-4-13z"
        stroke="#F59E0B"
        strokeWidth="2"
      />
    </svg>
  )
}

export function IconGlobe({ className }: { className?: string; filled?: boolean }) {
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
      <circle cx="12" cy="12" r="9" stroke="#22D3EE" strokeWidth="2" />
      <path d="M3 12h18" stroke="#3B82F6" strokeWidth="2" />
      <path d="M12 3a15 15 0 0 0 0 18a15 15 0 0 0 0-18z" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}

export function IconMonitor({ className }: { className?: string; filled?: boolean }) {
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
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M8 20h8" stroke="#A855F7" strokeWidth="2" />
      <path d="M12 16v4" stroke="#A855F7" strokeWidth="2" />
    </svg>
  )
}

export function IconMobile({ className }: { className?: string; filled?: boolean }) {
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
      <rect x="7" y="2" width="10" height="20" rx="2" stroke="#3B82F6" strokeWidth="2" />
      <circle cx="12" cy="18" r="1" fill="#10B981" stroke="#10B981" />
    </svg>
  )
}

export function IconPuzzle({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Components puzzle outline with accent
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
      <path
        d="M10 3h4a2 2 0 0 1 2 2v3h3a2 2 0 0 1 2 2v4h-3a2 2 0 0 0-2 2v3h-4a2 2 0 0 1-2-2v-3H5a2 2 0 0 1-2-2v-4h3a2 2 0 0 0 2-2z"
        stroke="#6366F1"
        strokeWidth="2"
      />
      <path d="M12 6a2 2 0 1 0 0 4" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}

export function IconArchive({ className }: { className?: string; filled?: boolean }) {
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
      <rect x="3" y="3" width="18" height="4" rx="1" stroke="#A855F7" strokeWidth="2" />
      <rect x="5" y="7" width="14" height="14" rx="2" stroke="#3B82F6" strokeWidth="2" />
      <path d="M9 12h6" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}

export function IconBricks({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Foundation bricks with warm palette
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
      <rect x="3" y="7" width="6" height="4" stroke="#F59E0B" strokeWidth="2" />
      <rect x="9" y="7" width="6" height="4" stroke="#FB923C" strokeWidth="2" />
      <rect x="15" y="7" width="6" height="4" stroke="#EF4444" strokeWidth="2" />
      <rect x="6" y="13" width="6" height="4" stroke="#A855F7" strokeWidth="2" />
      <rect x="12" y="13" width="6" height="4" stroke="#3B82F6" strokeWidth="2" />
    </svg>
  )
}

export function IconClamp({ className }: { className?: string; filled?: boolean }) {
  // Reworked: Compression clamp with distinct colors
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
      <rect x="5" y="2" width="14" height="4" rx="1" stroke="#A855F7" strokeWidth="2" />
      <path d="M7 6v6a3 3 0 0 0 3 3h4v4H9" stroke="#3B82F6" strokeWidth="2" />
      <path d="M17 10H10" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}

export function IconPalette({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M12 3a9 9 0 1 0 0 18h2a3 3 0 0 0 0-6h-1a2 2 0 0 1-2-2v-1a9 9 0 0 0 1-9z"
        stroke="#A855F7"
        strokeWidth="2"
      />
      <circle cx="7.5" cy="10" r="1.2" fill="#F59E0B" />
      <circle cx="9.5" cy="6.5" r="1.2" fill="#22D3EE" />
      <circle cx="12.5" cy="5.5" r="1.2" fill="#3B82F6" />
      <circle cx="15" cy="7.5" r="1.2" fill="#10B981" />
    </svg>
  )
}

// Added: GitHub logo
export function IconGitHub({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .5C5.73.5.98 5.24.98 11.5c0 4.85 3.15 8.96 7.51 10.41.55.1.76-.24.76-.54 0-.27-.01-1.16-.02-2.11-3.06.66-3.71-1.3-3.71-1.3-.5-1.26-1.22-1.6-1.22-1.6-1-.68.08-.67.08-.67 1.12.08 1.71 1.15 1.71 1.15.99 1.7 2.6 1.21 3.23.92.1-.72.39-1.21.71-1.49-2.44-.28-5-1.22-5-5.42 0-1.2.43-2.18 1.14-2.95-.11-.28-.5-1.42.11-2.96 0 0 .94-.3 3.08 1.13.89-.25 1.85-.37 2.8-.38.95.01 1.91.13 2.8.38 2.14-1.43 3.07-1.13 3.07-1.13.61 1.54.22 2.68.11 2.96.71.77 1.14 1.75 1.14 2.95 0 4.21-2.56 5.13-5.01 5.4.4.35.76 1.04.76 2.11 0 1.52-.01 2.74-.01 3.12 0 .3.2.65.76.54 4.36-1.45 7.51-5.56 7.51-10.41C23.02 5.24 18.27.5 12 .5z"
      />
    </svg>
  )
}

export function IconDatabase({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="8" ry="3" stroke="#3B82F6" strokeWidth="2" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" stroke="#93C5FD" strokeWidth="2" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" stroke="#22D3EE" strokeWidth="2" />
    </svg>
  )
}

// New: Tests icon (beaker + checkmark)
export function IconTests({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 3h6" stroke="#22D3EE" strokeWidth="2" />
      <path d="M10 3v7a6 6 0 1 0 4 0V3" stroke="#10B981" strokeWidth="2" />
      <path d="M8 10h8" stroke="#60A5FA" strokeWidth="2" />
      <path d="M15 16l2 2 4-4" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}

// New: Double up arrow icon used in Coverage report action button
export function IconDoubleUp({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 14 12 8 18 14" stroke="#3B82F6" strokeWidth="2" />
      <polyline points="6 20 12 14 18 20" stroke="#6366F1" strokeWidth="2" />
    </svg>
  )
}

export function IconSend({ className }: { className?: string }) {
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
      <line x1="22" y1="2" x2="11" y2="13" stroke="#3B82F6" strokeWidth="2" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="#10B981" strokeWidth="2" />
    </svg>
  )
}

export function IconAttach({ className }: { className?: string }) {
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
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        stroke="#A855F7"
        strokeWidth="2"
      ></path>
    </svg>
  )
}

export function IconCheckmarkCircle({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function IconStop({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <rect x="9" y="9" width="6" height="6"></rect>
    </svg>
  )
}

export function IconNotAllowed({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
    </svg>
  )
}

export function IconHourglass({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 2v6c0 2.2 1.8 4 4 4h4c2.2 0 4-1.8 4-4V2" />
      <path d="M6 12v6c0 2.2 1.8 4 4 4h4c2.2 0 4-1.8 4-4v-6" />
      <path d="M6 6h12" />
      <path d="M6 18h12" />
    </svg>
  )
}

export function IconScroll({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <line x1="10" y1="9" x2="8" y2="9"></line>
    </svg>
  )
}
