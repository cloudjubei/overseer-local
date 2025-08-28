import React from 'react';
import StatusBadge from './StatusBadge';
import type { Status } from 'src/types/tasks';

export interface FeatureSummaryProps {
  title: string;
  description: string;
  status: Status;
}

const FeatureSummaryCallout: React.FC<FeatureSummaryProps> = ({ title, description, status }) => (
  <div className="summary-card p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md max-w-xs">
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{description}</p>
    <StatusBadge status={status} variant="bold" />
  </div>
);

export default FeatureSummaryCallout;
