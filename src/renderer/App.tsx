import { useEffect, useState } from 'react';
import SidebarView from './screens/SidebarView';
import { ToastProvider } from './components/ui';
import { createRoot } from 'react-dom/client';

function App() {
  useEffect(() => {
    let theme = localStorage.getItem('theme');
    if (!theme) {
      theme = 'blue';
      localStorage.setItem('theme', theme);
    }
    document.documentElement.className = `theme-${theme}`;
  }, []);


  return (
    <ToastProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <SidebarView />
      </div>
    </ToastProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
