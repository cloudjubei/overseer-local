import React, { useMemo } from 'react'
import Tooltip from '../ui/Tooltip'
import { useProjectContext } from '../../contexts/ProjectContext'
import { useNavigator } from '../../navigation/Navigator'

export default function ProjectChip({
  projectId,
  className,
  nonActionable = false,
}: {
  projectId?: string | null
  className?: string
  nonActionable?: boolean
}) {
  const { projects, setActiveProjectId } = useProjectContext()
  const { navigateView } = useNavigator()

  const proj = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId])
  const label = proj?.title || projectId || '—'
  const description = proj?.description || ''

  const content = (
    <div>
      <div className="font-semibold text-xs mb-0.5">
        {proj?.title || projectId || 'Unknown Project'}
      </div>
      {description ? (
        <div className="text-xs text-neutral-300 whitespace-pre-wrap max-w-[260px]">
          {description}
        </div>
      ) : null}
    </div>
  )

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (nonActionable || !projectId) return
    setActiveProjectId(projectId)
    navigateView('Home')
  }

  const chipContent = (
    <>
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
      <span className="truncate max-w-[18ch]" style={{ lineHeight: 1 }}>
        {label}
      </span>
    </>
  )

  const commonClassNames = [
    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
    'bg-neutral-50 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200',
    'border-neutral-200 dark:border-neutral-700',
    className || '',
  ].join(' ')

  const chip = nonActionable ? (
    <div className={commonClassNames} title={label}>
      {chipContent}
    </div>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className={[
        commonClassNames,
        'hover:bg-neutral-100 dark:hover:bg-neutral-800',
        'disabled:opacity-70 disabled:cursor-not-allowed',
      ].join(' ')}
      title={label}
      disabled={!projectId}
    >
      {chipContent}
    </button>
  )

  return (
    <Tooltip content={content} placement="top" disabled={!projectId || nonActionable}>
      {chip}
    </Tooltip>
  )
}
