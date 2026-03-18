import React from 'react'

export default function GitSidebarSectionHeader({
  label,
  icon,
  open,
  onToggle,
}: {
  label: string
  icon: React.ReactNode
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left select-none
                 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors rounded"
    >
      {/* chevron */}
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        className={`shrink-0 text-neutral-400 transition-transform ${open ? '' : '-rotate-90'}`}
        fill="currentColor"
      >
        <path
          d="M1 3l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="w-3.5 h-3.5 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
        {icon}
      </span>
      <span className="text-[11px] font-semibold tracking-wide text-neutral-600 dark:text-neutral-300 uppercase">
        {label}
      </span>
    </button>
  )
}
