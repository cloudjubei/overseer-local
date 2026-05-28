import { Tooltip } from 'thefactory-ui/web'
import { StoryAndFeatureCallout } from 'thefactory-ui/web'

export type ContextInfoButtonProps = {
  storyId?: string
  featureId?: string
  label?: string
  className?: string
}

// "i" pill that opens a popover showing the story / feature this context
// belongs to. Used by chat headers / agent run rows. Web's port leans on
// `Tooltip`'s click-to-pin behaviour (Enter/click toggles, Esc / outside-
// click closes) — desktop hand-rolled the popover with `createPortal` and
// custom positioning, but `Tooltip` already covers that.
export default function ContextInfoButton({
  storyId,
  featureId,
  label,
  className = '',
}: ContextInfoButtonProps) {
  const hasAny = !!(storyId || featureId)

  const content = hasAny ? (
    <StoryAndFeatureCallout storyId={storyId} featureId={featureId} />
  ) : (
    <div className="text-xs px-1 py-0.5" style={{ color: 'var(--text-secondary)' }}>
      No contextual items.
    </div>
  )

  return (
    <Tooltip
      content={content}
      placement="bottom"
      anchorAs="button"
      anchorClassName={[
        'inline-flex items-center justify-center w-6 h-6 rounded-full',
        'border bg-transparent no-drag',
        'border-(--color-blue-500) text-(--color-blue-600)',
        'hover:bg-(--color-blue-50) dark:hover:bg-(--color-blue-900)/20',
        'focus:outline-none focus:ring-2 focus:ring-(--color-blue-500)/50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      anchorTabIndex={0}
    >
      <span className="text-[11px] font-semibold" aria-label={label || 'Chat context information'}>
        i
      </span>
    </Tooltip>
  )
}
