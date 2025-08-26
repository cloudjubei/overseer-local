import React from 'react';
import TaskCreateView from '../tasks/TaskCreateView';
import FeatureCreateView from '../tasks/FeatureCreateView';
import TaskEditView from '../tasks/TaskEditView';
import FeatureEditView from '../tasks/FeatureEditView';
import TaskDetailsView from '../tasks/TaskDetailsView';
import TasksListView from '../tasks/TasksListView';
function useTaskRouter() {
  const [hash, setHash] = React.useState(location.hash);

    React.useEffect(() => {
    const handleHashChange = () => setHash(location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  let match;
  if ((match = /^#task\/(\d+)$/.exec(hash))) {
    return { name: 'details', taskId: parseInt(match[1], 10) };
  }
  if ((match = /^#feature-create\/(\d+)$/.exec(hash))) {
    return { name: 'feature-create', taskId: parseInt(match[1], 10) };
  }
  if ((match = /^#task-create$/.exec(hash))) {
    return { name: 'task-create' };
  }
  if ((match = /^#task-edit\/(\d+)$/.exec(hash))) {
    return { name: 'task-edit', taskId: parseInt(match[1], 10) };
  }
  if ((match = /^#feature-edit\/(\d+)\/(.+)$/.exec(hash))) {
    return { name: 'feature-edit', taskId: parseInt(match[1], 10), featureId: match[2] };
  }
  return { name: 'list' };
}


const TasksView: React.FC = () => {
  const route = useTaskRouter();

  let content;
  switch (route.name) {
    case 'task-create':
      content = <TaskCreateView />;
      break;
    case 'feature-create':
      content = <FeatureCreateView taskId={route.taskId!} />;
      break;
    case 'task-edit':
      content = <TaskEditView taskId={route.taskId!} />;
      break;
    case 'feature-edit':
      content = <FeatureEditView taskId={route.taskId!} featureId={route.featureId!} />;
      break;
    case 'details':
      content = <TaskDetailsView taskId={route.taskId!} />;
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
