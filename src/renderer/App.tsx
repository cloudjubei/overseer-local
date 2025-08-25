import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  useEffect(() => {
    // Dynamically mount existing non-React views into these containers
    // This preserves current functionality while migrating to React entry.
    (async () => {
      try {
        await import('./tasksListView.js');
        await import('./taskDetailsView.js');
      } catch (e) {
        console.error('Failed to load legacy views:', e);
      }
    })();
  }, []);

  return (
    <div>
      <h1>Tasks Indexer</h1>
      <div id="tasks-view" />
      <div id="task-details-view" />
    </div>
  );
}

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);
