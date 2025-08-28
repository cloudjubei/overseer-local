import React from 'react';
import { useTasksIndex } from '../../hooks/useTasksIndex';
import { useNavigator } from '../../navigation/Navigator';
import Tooltip from '../ui/Tooltip';
import type { Status } from 'src/types/tasks';
import TaskSummaryCallout from './TaskSummaryCallout';
import FeatureSummaryCallout from './FeatureSummaryCallout';

export interface DependencyBulletProps {
  dependency: string; // format: "taskId" or "featureId" (it's of the format {taskId}.{featureIndex})
  isInbound?: boolean;
}

const DependencyBullet: React.FC<DependencyBulletProps> = ({ dependency, isInbound = false }) => {
  const index = useTasksIndex();
  const { navigateTaskDetails, tasksRoute } = useNavigator();

  const parts = dependency.split('.');
  const isFeatureDependency = parts.length > 1;
  const taskId = parseInt(parts[0], 10);
  const featureId = isFeatureDependency ? parts[1] : undefined;

  const task = index?.tasksById?.[taskId];
  const feature = isFeatureDependency ? task?.features?.find((f) => f.id === featureId) : undefined;

  const summary = isFeatureDependency
    ? feature
      ? {
          title: feature.title,
          description: feature.description,
          status: feature.status as Status,
        }
      : { title: 'Not found', description: '', status: '-' as Status }
    : task
    ? { title: task.title, description: task.description, status: task.status as Status }
    : { title: 'Not found', description: '', status: '-' as Status };

  const handleClick = () => {
    const isSameTask = tasksRoute.name === 'details' && tasksRoute.taskId === taskId;
    if (isSameTask) {
      if (featureId) {
        const row = document.querySelector(`.feature-row[data-feature-id="${featureId}"]`);
        if (row) {
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          row.classList.add('highlighted');
          setTimeout(() => row.classList.remove('highlighted'), 2000);
        }
      } else {
        const element = document.querySelector('.details-header');
        if (element) {
          element.scrollIntoView({ block: 'start', behavior: 'smooth' });
          element.classList.add('highlighted');
          setTimeout(() => element.classList.remove('highlighted'), 2000);
        }
      }
    } else {
      if (featureId) {
        navigateTaskDetails(taskId, featureId);
      } else {
        navigateTaskDetails(taskId, undefined, true);
      }
    }
  };
  const content = isFeatureDependency ? <FeatureSummaryCallout {...summary} /> : <TaskSummaryCallout {...summary} />;

  return (
    <Tooltip content={content}>
      <span
        className={`chip  ${isFeatureDependency ? 'feature' : 'task'} ${isInbound ? 'chip--blocks' : 'dep-chip--ok'}`}
        title={`${dependency}${isInbound ? ' (requires this)' : ''}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        #{dependency}
      </span>
    </Tooltip>
  );
};

export default DependencyBullet;
