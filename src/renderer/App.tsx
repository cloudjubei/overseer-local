import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import TasksView from './components/TasksView';
import Docs from './components/Docs';
import Settings from './Settings';
import { View } from './types';
import { ToastProvider } from './components/ui';
import { createRoot } from 'react-dom/client';

function App() {
  const [currentView, setCurrentView] = useState<View>('Home');
  useEffect(() => {
    let theme = localStorage.getItem('theme');
    if (!theme) {
      theme = 'blue';
      localStorage.setItem('theme', theme);
    }
    document.documentElement.className = `theme-${theme}`;
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'Home':
        return <TasksView />;
      case 'Docs':
        return <Docs />;
      case 'Settings':
        return <Settings />;
      default:
        return <TasksView />;
    }
  };

  return (
    <ToastProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
        <main className="flex-1 overflow-auto p-4">
          {renderView()}
        </main>
      </div>
    </ToastProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
