import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import TasksListView from './TasksListView';
import TaskDetailsView from './TaskDetailsView';

function App() {
  const [hash, setHash] = useState(window.location.hash);
  const [index, setIndex] = useState<any>(null);

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const idx = await window.tasksIndex.getSnapshot();
        setIndex(idx);
        window.tasksIndex.onUpdate(setIndex);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const renderIndexInfo = () => {
    if (!index) return <div>Loading...</div>;
    const count = Object.keys(index.tasksById || {}).length;
    const featCount = Object.keys(index.featuresByKey || {}).length;
    const errors = index.errors || [];
    return (
      <div>
        <div><strong>Tasks Dir:</strong> {index.tasksDir}</div>
        <div><strong>Tasks:</strong> {count}</div>
        <div><strong>Features:</strong> {featCount}</div>
        <div><strong>Last Scan:</strong> {new Date(index.updatedAt).toLocaleString()}</div>
        <div><strong>Scan Time:</strong> {index.metrics?.lastScanMs ?? 0} ms</div>
        <div><strong>Errors:</strong> {errors.length}</div>
        <pre style={{maxHeight: '200px', overflow: 'auto', background: '#f8f8f8', padding: '8px', border: '1px solid #eee'}}>
          {errors.map((e: any) => `${e.path}: ${e.error}`).join('\n')}
        </pre>
      </div>
    );
  };

  return (
    <div>
      <h1>Tasks Indexer</h1>
      <p>This app scans tasks/{id}/task.json and watches for changes.</p>
      {hash.startsWith('#task/') ? <TaskDetailsView hash={hash} /> : <TasksListView />}
      <hr />
      <div id="tasks-info">
        <strong>Index:</strong>
        {renderIndexInfo()}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
