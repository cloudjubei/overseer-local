import React from 'react';
import { createRoot } from 'react-dom/client';
import TasksListView from './TasksListView';
import TaskDetailsView from './TaskDetailsView';
import TaskCreateView from './TaskCreateView';
import FeatureCreateView from './FeatureCreateView';
import TaskEditView from './TaskEditView';
import FeatureEditView from './FeatureEditView';
import SettingsView from './SettingsView';
import { ToastProvider } from './components/ui/toast';

function useAppRouter() {
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
  if (hash === '#settings') {
    return { name: 'settings' };
  }
  return { name: 'list' };
}

const App = () => {
  const route = useAppRouter();

  let content;
  switch (route.name) {
    case 'task-create':
      content = <TaskCreateView />;
      break;
    case 'feature-create':
      content = <FeatureCreateView taskId={route.taskId} />;
      break;
    case 'task-edit':
      content = <TaskEditView taskId={route.taskId} />;
      break;
    case 'feature-edit':
      content = <FeatureEditView taskId={route.taskId} featureId={route.featureId} />;
      break;
    case 'details':
      content = <TaskDetailsView taskId={route.taskId} />;
      break;
    case 'settings':
      content = <SettingsView />;
      break;
    default:
      content = <TasksListView />;
      break;
  }

  return (
    <ToastProvider>
      <div style={{ fontFamily: 'sans-serif' }}>
        {content}
      </div>
    </ToastProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
