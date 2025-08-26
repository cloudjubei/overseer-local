import { useEffect } from 'react';
import SidebarView from './screens/SidebarView';
import { createRoot } from 'react-dom/client';

// Provide a very light-weight ToastProvider stub to avoid missing import issues
function ToastProvider({ children }: { children: any }) { return children; }

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
      <div className="flex h-full w-full overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
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
