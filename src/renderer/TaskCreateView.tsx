import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';

function TaskCreateView() {
  useEffect(() => {
    (async () => {
      try { await import('./taskCreateView.js'); } catch (e) { console.error(e); }
    })();
  }, []);
  return <div id="task-create-view" className="container" />;
}

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<TaskCreateView />);
