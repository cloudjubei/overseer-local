import { useEffect } from 'react';
import SidebarView from './screens/SidebarView';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './components/ui';
import { NavigatorProvider } from './navigation';
import ModalHost from './navigation/ModalHost';

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
      <NavigatorProvider>
        <div className="flex h-full w-full overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
          <SidebarView />
          {/* Global modal layer */}
          <ModalHost />
        </div>
      </NavigatorProvider>
    </ToastProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
