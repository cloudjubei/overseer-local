import { Story } from 'thefactory-tools'
import StatusControl from './StatusControl'

export default function StorySummaryCard({
  story,
  className = '',
}: {
  story: Story
  className?: string
}) {
  return (
    <div className={`story-summary-card ${className}`}>
      <div className="summary-card__header">
        <h4 className="summary-card__title">{story.title}</h4>
        <StatusControl status={story.status} />
      </div>
      <p className="summary-card__description">{story.description}</p>
    </div>
  )
}
