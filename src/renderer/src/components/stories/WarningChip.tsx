import { IconExclamation } from 'thefactory-ui/web/icons'

export default function WarningChip({ title, tooltip }: { title: string; tooltip: string }) {
  return (
    <span className="warning-badge" aria-label={tooltip} title={title}>
      <IconExclamation className="w-4 h-4" />
    </span>
  )
}
