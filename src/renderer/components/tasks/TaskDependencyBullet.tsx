import React from 'react';
import { useTasksIndex } from '../../hooks/useTasksIndex';
import { useNavigator } from '../../navigation/Navigator';
import TaskSummaryCallout from './TaskSummaryCallout';
import Tooltip from '../ui/Tooltip'; // Assuming Tooltip exists

import type { Status } from 'src/types/tasks';

export interface TaskDependencyBulletProps {
  taskId: number;
  isInbound?: boolean;
}

const TaskDependencyBullet: React.FC<TaskDependencyBulletProps> = ({ taskId, isInbound = false }) => {
  const index = useTasksIndex();
  const { navigateTaskDetails } = useNavigator();

  const task = index?.tasksById?.[taskId];

  const summary = task ? {
    title: task.title,
    description: task.description,
    status: task.status as Status,
  } : {
    title: 'Not found',
    description: '',
    status: '-' as Status,
  };

  const handleClick = () => {
    navigateTaskDetails(taskId);
  };

  return (
    <Tooltip content={<TaskSummaryCallout {...summary} />}>
      <span
        className="dependency-bullet cursor-pointer px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm"
        onClick={handleClick}
        aria-label={`Task ${taskId}${isInbound ? ' (requires this)' : ''}`}
      >
        #{taskId}
      </span>
    </Tooltip>
  );
};

export default TaskDependencyBullet;
