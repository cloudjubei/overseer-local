import React from 'react';
import { useTasksIndex } from '../../hooks/useTasksIndex';
import { useNavigator } from '../../navigation/Navigator';
import FeatureSummaryCallout from './FeatureSummaryCallout';
import Tooltip from '../ui/Tooltip'; // Assuming Tooltip exists

import type { Status } from 'src/types/tasks';

export interface FeatureDependencyBulletProps {
  fullId: string;
  isInbound?: boolean;
}

const FeatureDependencyBullet: React.FC<FeatureDependencyBulletProps> = ({ fullId, isInbound = false }) => {
  const index = useTasksIndex();
  const { navigateTaskDetails } = useNavigator();

  const [taskIdStr, featureId] = fullId.split('.');
  const taskId = parseInt(taskIdStr, 10);

  const task = index?.tasksById?.[taskId];
  const feature = task?.features?.find(f => f.id === featureId);

  const summary = feature ? {
    title: feature.title,
    description: feature.description,
    status: feature.status as Status,
  } : {
    title: 'Not found',
    description: '',
    status: '-' as Status,
  };

  const handleClick = () => {
    navigateTaskDetails(taskId, featureId);
  };

  return (
    <Tooltip content={<FeatureSummaryCallout {...summary} />}>
      <span
        className="dependency-bullet cursor-pointer px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm"
        onClick={handleClick}
        aria-label={`Feature ${fullId}${isInbound ? ' (requires this)' : ''}`}
      >
        #{fullId}
      </span>
    </Tooltip>
  );
};

export default FeatureDependencyBullet;
