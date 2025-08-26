import { useEffect } from 'react';
import SidebarView from './screens/SidebarView';
import { createRoot } from 'react-dom/client';
import ModalHost from './navigation/ModalHost';
import { ToastProvider } from './components/ui/Toast';
import { NavigatorProvider, useNavigator } from './navigation/Navigator';
import { ShortcutsProvider, useShortcuts, match } from './hooks/useShortcuts';
import CommandMenu from './components/ui/CommandMenu';
import ShortcutsHelp from './components/ui/ShortcutsHelp';
import { initTheme } from './hooks/useTheme';

function GlobalShortcutsBootstrap() {
  const { register } = useShortcuts();
  const nav = useNavigator();

  useEffect(() => {
    // Cmd/Ctrl+N: New Task
    const unregisterNew = register({ id: 'new-task', keys: match.modN, handler: () => nav.openModal({ type: 'task-create' }), description: 'New task' });
    // Esc closes modals: Navigator handles via hash; here we just allow default unless needed
    return () => { unregisterNew(); };
  }, [register, nav]);

  useEffect(() => {
    // Example success feedback after navigation changes (visual polish)
    // Could be triggered after real operations; left as hook for future use
    const onHash = () => {};
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return null;
}

function App()
{
  useEffect(() => { initTheme() }, [])

  return (
    <ToastProvider>
      <NavigatorProvider>
        <ShortcutsProvider>
          <GlobalShortcutsBootstrap />
          <CommandMenu />
          <ShortcutsHelp />
          <div className="flex h-full w-full overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
            <SidebarView />
            <ModalHost />
          </div>
        </ShortcutsProvider>
      </NavigatorProvider>
    </ToastProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
