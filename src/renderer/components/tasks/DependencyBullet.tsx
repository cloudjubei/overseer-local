import React from 'react';
import { useTasksIndex } from '../../hooks/useTasksIndex';
import { useNavigator } from '../../navigation/Navigator';
import Tooltip from '../ui/Tooltip';
import type { Status } from 'src/types/tasks';
import TaskSummaryCallout from './TaskSummaryCallout';
import FeatureSummaryCallout from './FeatureSummaryCallout';

export interface DependencyBulletProps {
  dependency: string;
  isInbound?: boolean;
}

const DependencyBullet: React.FC<DependencyBulletProps> = ({ dependency, isInbound = false }) => {
  const index = useTasksIndex();
  const { navigateTaskDetails } = useNavigator();

  const parts = dependency.split('.');
  const isFeatureDependency = parts.length > 0
  const taskId = parseInt(parts[0], 10);
  const featureId = isFeatureDependency ? parts[1] : undefined

  const task = index?.tasksById?.[taskId];
  const feature = task?.features?.find(f => f.id === dependency);

  const summary = isFeatureDependency ? (
    feature ? {
      title: feature.title,
      description: feature.description,
      status: feature.status as Status,
    } : {
      title: 'Not found',
      description: '',
      status: '-' as Status,
    }
  ) : (
    task ? {
      title: task.title,
      description: task.description,
      status: task.status as Status,
    } : {
      title: 'Not found',
      description: '',
      status: '-' as Status,
    }
  )

  const handleClick = () => {
    navigateTaskDetails(taskId, featureId);
  };
  const content = isFeatureDependency ? <FeatureSummaryCallout {...summary} /> : <TaskSummaryCallout {...summary} />

  return (
    <Tooltip content={content}>
      <span
        className="dependency-bullet"
        onClick={handleClick}
        aria-label={`${dependency}${isInbound ? ' (requires this)' : ''}`}
      >
        #{dependency}
      </span>
    </Tooltip>
  );
};

export default DependencyBullet;
