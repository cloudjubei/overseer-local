import { Feature } from 'thefactory-tools'
import StatusControl from './StatusControl'

export default function FeatureSummaryCard({
  feature,
  className = '',
}: {
  feature: Feature
  className?: string
}) {
  return (
    <div className={`feature-summary-card ${className}`}>
      <div className="summary-card__header">
        <h4 className="summary-card__title">{feature.title}</h4>
        <StatusControl status={feature.status} />
      </div>
      <p className="summary-card__description">{feature.description}</p>
    </div>
  )
}
