import React from 'react';
import { Feature } from 'src/types/tasks';
import StatusBadge from './StatusBadge';

export default function FeatureSummaryCard({ feature, className = '' }: { feature: Feature; className?: string }) {
  return (
    <div className={`feature-summary-card ${className}`}>
      <div className="summary-card__header">
        <h4 className="summary-card__title">{feature.title}</h4>
        <StatusBadge status={feature.status} />
      </div>
      <p className="summary-card__description">{feature.description}</p>
    </div>
  );
}
