import React from 'react';
import TaskDetailsView from '../tasks/TaskDetailsView';
import TasksListView from '../tasks/TasksListView';
import { useNavigator } from '../navigation/Navigator';

const TasksView: React.FC = () => {
  const { tasksRoute } = useNavigator();

  let content;
  switch (tasksRoute.name) {
    case 'details':
      content = <TaskDetailsView taskId={tasksRoute.taskId} />;
      break;
    default:
      content = <TasksListView />;
      break;
  }

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      {content}
    </div>
  );
};

export default TasksView;
