import { CSSProperties } from 'react'

export function IconBack({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  )
}

export function IconEdit({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}
export function IconDelete({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

export function IconPlus({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  )
}

export function IconExclamation({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

export function IconChevron({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" stroke="#6366F1" strokeWidth="2"></polyline>
    </svg>
  )
}

export function IconPlay({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <polygon points="8,5 19,12 8,19" />
    </svg>
  )
}

export function IconList({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1.5" />
      <circle cx="4" cy="12" r="1.5" />
      <circle cx="4" cy="18" r="1.5" />
    </svg>
  )
}

export function IconBoard({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="10" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="15" width="7" height="6" rx="1.5" />
    </svg>
  )
}

export function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-5" />
    </svg>
  )
}

export function IconXCircle({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  )
}

export function IconStopCircle({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}

export function IconLoader({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" />
    </svg>
  )
}

// Small arrow icons for token chip
export function IconArrowLeftMini({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="14 18 8 12 14 6" />
    </svg>
  )
}

export function IconArrowRightMini({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="10 6 16 12 10 18" />
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
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14 9V5a3 3 0 0 0-3-3l-1 5-4 5v8h9a3 3 0 0 0 3-3v-6a2 2 0 0 0-2-2h-2z" />
      <path d="M7 21H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
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
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M10 15v4a3 3 0 0 0 3 3l1-5 4-5V4H9A3 3 0 0 0 6 7v6a2 2 0 0 0 2 2h2z" />
      <path d="M17 3h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
    </svg>
  )
}

export function IconHome({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
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
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7z"
        stroke="#6366F1"
        strokeWidth="2"
      />
      <path d="M14 2v5h5" stroke="#93C5FD" strokeWidth="2" />
      <path d="M8 13h6" stroke="#60A5FA" strokeWidth="2" />
      <path d="M8 17h6" stroke="#60A5FA" strokeWidth="2" />
    </svg>
  )
}

export function IconChat({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
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
      width="16"
      height="16"
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

export function IconAntenna({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
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
      width="16"
      height="16"
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
      width="16"
      height="16"
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
      width="16"
      height="16"
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

export function IconWorkspace({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="3" y="13" width="6" height="8" rx="2" />
      <rect x="11" y="13" width="10" height="8" rx="2" />
    </svg>
  )
}

export function IconWarningTriangle({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
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
      width="16"
      height="16"
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
      width="16"
      height="16"
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

export function IconTestTube({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  //TODO: needs to be reworked to match reference - 🧪 - Testing - Needs to be green/blue colored - neon like

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M9 3h6" />
      <path d="M10 3v8a6 6 0 1 0 4 0V3" />
      <path d="M8 11h8" />
    </svg>
  )
}

export function IconWrench({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  //TODO: needs to be reworked to match reference - 🔧 - Tools - preferrable this should actually be a pink/red monkey wrench
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 3a7 7 0 0 1-9.9 9.9L7 17l-3 3 3-7 4.1-4.1A7 7 0 0 1 21 3z" />
      <circle cx="7" cy="17" r="0.5" />
    </svg>
  )
}

export function IconBuild({ className, filled = false }: { className?: string; filled?: boolean }) {
  //TODO: needs to be reworked to match reference - 🛠️ - Build - the hammer should be one color, the wrench the other
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14.7 6.3l3 3L7 20H4v-3z" />
      <path d="M13 5l6 6" />
      <path d="M2 22l2-5 3 3-5 2z" />
    </svg>
  )
}

export function IconRocket({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  //TODO: needs to be reworked to match reference - 🚀 - Launch - needs to be colorful like reference
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14 3l7 7-6 6-7-7z" />
      <path d="M14 3s-4 1-7 4-4 7-4 7l6-2 7-7z" />
      <path d="M5 19l3-3" />
      <path d="M8 22l3-3" />
      <circle cx="15" cy="9" r="1.5" />
    </svg>
  )
}

export function IconToolbox({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="8" width="18" height="11" rx="2" />
      <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
      <path d="M10 13v3" />
      <path d="M14 13v3" />
    </svg>
  )
}

export function IconInfrastructure({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  //TODO: needs to be reworked to match reference - 🏗️ - Infrastructure
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="10" width="6" height="10" />
      <rect x="10.5" y="6" width="6" height="14" />
      <rect x="18" y="3" width="3" height="17" />
      <path d="M3 10l6-4 7-3 5-1" />
    </svg>
  )
}

export function IconBrain({ className, filled = false }: { className?: string; filled?: boolean }) {
  //TODO: needs to be reworked to match reference -  🧠 - AI/ML
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 6a3 3 0 0 0-3 3v6a3 3 0 1 0 3 3" />
      <path d="M8 6a3 3 0 1 0 0 6" />
      <path d="M16 6a3 3 0 0 1 3 3v6a3 3 0 1 1-3 3" />
      <path d="M16 6a3 3 0 1 1 0 6" />
      <path d="M12 4v16" />
    </svg>
  )
}

export function IconDocument({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  )
}

export function IconTarget({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  //TODO: needs to be reworked to match reference -  🎯 - Goals - NEEDS TO BE WHITE AND RED like reference

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

export function IconMicroscope({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  //TODO: needs to be reworked to match reference -  🔬 - Research
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 19h12" />
      <path d="M9 19a5 5 0 1 1 10 0" />
      <rect x="4" y="3" width="6" height="3" rx="1" />
      <path d="M7 6v5a4 4 0 0 0 4 4h3" />
      <path d="M14 11h4" />
    </svg>
  )
}

export function IconBug({ className, filled = false }: { className?: string; filled?: boolean }) {
  //TODO: needs to be reworked to match reference -  🐞 - Bug
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="7" y="8" width="10" height="8" rx="4" />
      <path d="M12 8V4" />
      <path d="M4 12h4" />
      <path d="M16 12h4" />
      <path d="M5 9l3 2" />
      <path d="M19 9l-3 2" />
      <path d="M5 15l3-2" />
      <path d="M19 15l-3-2" />
    </svg>
  )
}

export function IconPackage({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v9" />
    </svg>
  )
}

export function IconSearch({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function IconLightbulb({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 13c1 1 1 2 1 3h6c0-1 0-2 1-3a7 7 0 0 0-4-13z" />
    </svg>
  )
}

export function IconGlobe({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 0 0 18a15 15 0 0 0 0-18z" />
    </svg>
  )
}

export function IconMonitor({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  )
}

export function IconMobile({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <circle cx="12" cy="18" r="1" />
    </svg>
  )
}

export function IconPuzzle({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  //TODO: needs to be reworked to match reference -  🧩 - Components
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M10 3h4a2 2 0 0 1 2 2v3h3a2 2 0 0 1 2 2v4h-3a2 2 0 0 0-2 2v3h-4a2 2 0 0 1-2-2v-3H5a2 2 0 0 1-2-2v-4h3a2 2 0 0 0 2-2z" />
      <path d="M12 6a2 2 0 1 0 0 4" />
    </svg>
  )
}

export function IconArchive({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="18" height="4" rx="1" />
      <rect x="5" y="7" width="14" height="14" rx="2" />
      <path d="M9 12h6" />
    </svg>
  )
}

export function IconBricks({
  className,
  filled = false,
}: {
  className?: string
  filled?: boolean
}) {
  //TODO: needs to be reworked to match reference -  🧱 - Foundation

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="7" width="6" height="4" />
      <rect x="9" y="7" width="6" height="4" />
      <rect x="15" y="7" width="6" height="4" />
      <rect x="6" y="13" width="6" height="4" />
      <rect x="12" y="13" width="6" height="4" />
    </svg>
  )
}

export function IconClamp({ className, filled = false }: { className?: string; filled?: boolean }) {
  //TODO: needs to be reworked to match reference -  🗜️ - Compression

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="5" y="2" width="14" height="4" rx="1" />
      <path d="M7 6v6a3 3 0 0 0 3 3h4v4H9" />
      <path d="M17 10H10" />
    </svg>
  )
}
