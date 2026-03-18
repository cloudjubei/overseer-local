import React from 'react'
import Tooltip from '../../../components/ui/Tooltip'

export default function GitActionButton({
  icon,
  label,
  onClick,
  disabled,
  tooltip,
  badge,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  tooltip?: string
  badge?: number
}) {
  const btn = (
    <button
      className={
        'w-[52px] h-[52px] shrink-0 rounded-xl border border-neutral-200 dark:border-neutral-800 ' +
        'bg-white dark:bg-neutral-950/30 ' +
        'hover:bg-neutral-50 dark:hover:bg-neutral-900/40 ' +
        'active:scale-[0.98] transition ' +
        'flex flex-col items-center justify-center gap-1 relative ' +
        (disabled
          ? 'opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-neutral-950/30'
          : '')
      }
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <div className="w-5 h-5 text-neutral-700 dark:text-neutral-200 flex items-center justify-center">
        {icon}
      </div>
      <div className="text-[10px] leading-3 text-neutral-700 dark:text-neutral-300 text-center px-1">
        {label}
      </div>
      {badge !== undefined && badge > 0 && (
        <div className="absolute top-1 right-1 bg-blue-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-md leading-none shadow-sm min-w-[16px] text-center">
          {badge}
        </div>
      )}
    </button>
  )
  return tooltip ? <Tooltip content={tooltip}>{btn}</Tooltip> : btn
}
