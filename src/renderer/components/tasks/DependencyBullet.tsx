import React from 'react';
import { useNavigator } from '../../navigation/Navigator';
import Tooltip from '../ui/Tooltip';
import type { Status } from 'src/types/tasks';
import TaskSummaryCallout from './TaskSummaryCallout';
import FeatureSummaryCallout from './FeatureSummaryCallout';
import { dependencyResolver } from '../../services/dependencyResolver';

export interface DependencyBulletProps {
  dependency: string; // format: "taskId" or "featureId" (it's of the format {taskId}.{featureIndex})
  isInbound?: boolean;
  onRemove?: () => void;
}

const DependencyBullet: React.FC<DependencyBulletProps> = ({ dependency, isInbound = false, onRemove }) => {
  const { navigateTaskDetails, tasksRoute } = useNavigator();

  const resolved = dependencyResolver.resolveRef(dependency);
  const isError = 'code' in resolved;
  const isFeatureDependency = !isError && resolved.kind === 'feature';
  const display = dependencyResolver.getDisplayRef(dependency) ?? dependency;

  let summary: { title: string; description: string; status: Status; displayId: string } = { title: 'Not found', description: '', status: '-' as Status, displayId: display };

  if (!isError) {
    if (resolved.kind === 'task') {
      summary = { title: resolved.task.title, description: resolved.task.description, status: resolved.task.status as Status, displayId: display };
    } else {
      summary = { title: resolved.feature.title, description: resolved.feature.description, status: resolved.feature.status as Status, displayId: display };
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
        className={`chip  ${isFeatureDependency ? 'feature' : 'task'} ${isError ? 'chip--missing' : (isInbound ? 'chip--blocks' : 'chip--ok')}`}
        title={`${display}${isInbound ? ' (requires this)' : ''}`}
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
        #{display}
        {onRemove && <span aria-hidden="true">x</span>}
      </span>
    </Tooltip>
  );
};

export default DependencyBullet;
