import React from 'react';
import { createRoot } from 'react-dom/client';
import TasksListView from './TasksListView';
import TaskDetailsView from './TaskDetailsView';
import TaskCreateView from './TaskCreateView'; 
import FeatureCreateView from './FeatureCreateView'; 

function useAppRouter() {
  const [hash, setHash] = React.useState(location.hash);

  React.useEffect(() => {
    const handleHashChange = () => setHash(location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const taskMatch = /^#task\/(\d+)$/.exec(hash);
  if (taskMatch) {
    return { name: 'details', hash };
  }

  const featureCreateMatch = /^#feature-create\/(\d+)$/.exec(hash);
  if (featureCreateMatch) {
    return { name: 'feature-create', taskId: parseInt(featureCreateMatch[1], 10) };
  }

  if (hash === '#task-create') {
    return { name: 'task-create' };
  }

  return { name: 'list', hash };
}

const App = () => {
  const route = useAppRouter();

  if (route.name === 'task-create') {
    return <TaskCreateView />;
  }
  if (route.name === 'feature-create') {
    return <FeatureCreateView  taskId={route.taskId!}/>;
  }

  // Otherwise, render the main application layout.
  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <h1>Project Tasks</h1>
      {route.name === 'details' ? (
        <TaskDetailsView hash={route.hash!} />
      ) : (
        <TasksListView />
      )}
    </div>
  );
};


const container = document.getElementById("root");
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}