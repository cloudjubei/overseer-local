import React from 'react';
import StatusControl from './StatusControl';
import type { Status } from 'packages/factory-ts/src/types'

export interface TaskSummaryProps {
  title: string;
  description: string;
  status: Status;
  displayId: string;
}

const TaskSummaryCallout: React.FC<TaskSummaryProps> = ({ title, description, status, displayId }) => (
  <div className="summary-card p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md max-w-xs">
    <div className="text-xs text-gray-500 mb-1">Task #{displayId}</div>
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{description}</p>
    <StatusControl status={status}/>
  </div>
);

export default TaskSummaryCallout;
