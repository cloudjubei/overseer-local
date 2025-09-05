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

const UI_IMPROVEMENTS_TASK_ID = 'f67e8921-b197-40c9-9154-e95db8f27deb';

function GlobalShortcutsBootstrap() {
  const { register } = useShortcuts();
  const nav = useNavigator();

  useEffect(() => {
    // Cmd/Ctrl+N: New Task
    const unregisterNew = register({ id: 'new-task', keys: match.modN, handler: () => nav.openModal({ type: 'task-create' }), description: 'New task' });
    // Cmd/Ctrl+Shift+F: Add Feature to UI Improvements
    const unregisterAddUiFeature = register({
      id: 'add-ui-feature',
      keys: (e: KeyboardEvent) => (e.key === 'f' || e.key === 'F') && (e.ctrlKey || e.metaKey) && e.shiftKey,
      handler: () => nav.openModal({ type: 'feature-create', taskId: UI_IMPROVEMENTS_TASK_ID }),
      description: 'Add feature to UI Improvements',
      scope: 'global'
    });
    return () => { unregisterNew(); unregisterAddUiFeature(); };
  }, [register, nav]);

  useEffect(() => {
    const onHash = () => {};
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return null;
}

function NotificationClickHandler() {
  const nav = useNavigator();

  useEffect(() => {
    const unsubscribe = window.notificationsService.onOpenNotification((metadata: NotificationMetadata) => {
      if (metadata.taskId) {
        nav.navigateTaskDetails(metadata.taskId, metadata.featureId);
      } else if (metadata.chatId) {
        nav.navigateView('Chat');
      } else if (metadata.documentPath) {
        nav.navigateView('Files');
      } else if (metadata.actionUrl) {
        // Handle custom URL if needed
      }
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
            <div className="flex h-full w-full overflow-hidden">
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
