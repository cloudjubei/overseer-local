import React from 'react';
import { useNavigator } from '../../navigation/Navigator';
import Tooltip from '../ui/Tooltip';
import type { Status } from 'src/types/tasks';
import TaskSummaryCallout from './TaskSummaryCallout';
import FeatureSummaryCallout from './FeatureSummaryCallout';
import { taskService } from '../../services/taskService';

export interface DependencyBulletProps {
  dependency: string; // format: "taskId" or "featureId" (it's of the format {taskId}.{featureIndex})
  isInbound?: boolean;
  onRemove?: () => void;
}

const DependencyBullet: React.FC<DependencyBulletProps> = ({ dependency, isInbound = false, onRemove }) => {
  const { navigateTaskDetails, tasksRoute } = useNavigator();

  const resolved = taskService.resolveRef(dependency);
  const isError = 'code' in resolved;
  const isFeatureDependency = !isError && resolved.kind === 'feature';

  let summary: { title: string; description: string; status: Status } = { title: 'Not found', description: '', status: '-' as Status };

  if (!isError) {
    if (resolved.kind === 'task') {
      summary = { title: resolved.task.title, description: resolved.task.description, status: resolved.task.status as Status };
    } else {
      summary = { title: resolved.feature.title, description: resolved.feature.description, status: resolved.feature.status as Status };
    }
  }

  const handleClick = () => {
    if (onRemove){
      onRemove()
      return
    }
    if (isError) return;

    const targetTaskId = resolved.kind === 'task' ? resolved.id : resolved.taskId;
    const featureId = resolved.kind === 'feature' ? resolved.featureId : undefined;


    const isSameTask = tasksRoute.name === 'details' && tasksRoute.taskId === targetTaskId;
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
      navigateTaskDetails(targetTaskId, featureId, !featureId);
    }
  };

  const content = isFeatureDependency ? <FeatureSummaryCallout {...summary} /> : <TaskSummaryCallout {...summary} />;

  return (
    <Tooltip content={content}>
      <span
        className={`chip  ${isFeatureDependency ? 'feature' : 'task'} ${isError ? 'chip--missing' : (isInbound ? 'chip--blocks' : 'chip--ok')} flex`}
        title={`${dependency}${isInbound ? ' (requires this)' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          handleClick();
        }}
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
        {onRemove && (
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="3" x2="9" y2="9" />
            <line x1="9" y1="3" x2="3" y2="9" />
          </svg>
        )}
      </span>
    </Tooltip>
  );
};

export default DependencyBullet;
