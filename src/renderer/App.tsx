import { useEffect, useState } from 'react';
import SidebarView from './components/SidebarView';
import TasksView from './screens/TasksView';
import DocumentsView from './screens/DocumentsView';
import SettingsView from './screens/SettingsView';
import ChatView from './screens/ChatView';
import { NavigationView } from './types';
import { ToastProvider } from './components/ui';
import { createRoot } from 'react-dom/client';

function App() {
  const [currentView, setCurrentView] = useState<NavigationView>('Home');
  useEffect(() => {
    let theme = localStorage.getItem('theme');
    if (!theme) {
      theme = 'blue';
      localStorage.setItem('theme', theme);
    }
    document.documentElement.className = `theme-${theme}`;
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1).toLowerCase();
      switch (hash) {
        case 'home':
          setCurrentView('Home');
          break;
        case 'documents':
          setCurrentView('Documents');
          break;
        case 'chat':
          setCurrentView('Chat');
          break;
        case 'settings':
          setCurrentView('Settings');
          break;
        default:
          setCurrentView('Home');
          break;
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'Home':
        return <TasksView />;
      case 'Documents':
        return <DocumentsView />;
      case 'Settings':
        return <SettingsView />;
      case 'Chat':
        return <ChatView />;
      default:
        return <TasksView />;
    }
  };

  return (
    <ToastProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <SidebarView currentView={currentView} setCurrentView={setCurrentView} />
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
