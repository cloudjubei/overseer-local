import { useEffect } from 'react';
import SidebarView from './navigation/SidebarView';
import { createRoot } from 'react-dom/client';
import ModalHost from './navigation/ModalHost';
import { ToastProvider } from './components/ui/Toast';
import { NavigatorProvider, useNavigator } from './navigation/Navigator';
import { ShortcutsProvider, useShortcuts, match } from './hooks/useShortcuts';
import CommandMenu from './components/ui/CommandMenu';
import ShortcutsHelp from './components/ui/ShortcutsHelp';
import { initTheme } from './hooks/useTheme';
import { NotificationMetadata } from '../types/notifications';
import { ProjectsProvider } from './projects/ProjectContext';

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

function NotificationClickHandler() {
  const nav = useNavigator();

  useEffect(() => {
    const unsubscribe = window.notifications.onClicked((metadata: NotificationMetadata) => {
      if (metadata.taskId) {
        nav.navigateTaskDetails(parseInt(metadata.taskId, 10));
      } else if (metadata.chatId) {
        nav.navigateView('Chat');
        // TODO: handle specific chat
      } else if (metadata.documentPath) {
        nav.navigateView('Documents');
        // TODO: open specific doc
      } else if (metadata.actionUrl) {
        // Handle custom URL if needed
      }
      // Mark as read? Handled separately
    });

    return unsubscribe;
  }, [nav]);

  return null;
}

function App()
{
  useEffect(() => { initTheme() }, [])

  return (
    <ToastProvider>
      <ProjectsProvider>
        <NavigatorProvider>
          <ShortcutsProvider>
            <GlobalShortcutsBootstrap />
            <NotificationClickHandler />
            <CommandMenu />
            <ShortcutsHelp />
            <div className="flex h-full w-full overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
              <SidebarView />
              <ModalHost />
            </div>
          </ShortcutsProvider>
        </NavigatorProvider>
      </ProjectsProvider>
    </ToastProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
