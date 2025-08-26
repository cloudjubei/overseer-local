import { useEffect } from 'react';
import SidebarView from './screens/SidebarView';
import { createRoot } from 'react-dom/client';
import ModalHost from './navigation/ModalHost';
import { ToastProvider } from './components/ui/toast';
import { NavigatorProvider } from './navigation/Navigator';

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
