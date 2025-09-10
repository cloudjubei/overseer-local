import { useEffect, useState, useCallback } from 'react';
import SidebarView from './navigation/SidebarView';
import { createRoot } from 'react-dom/client';
import ModalHost from './navigation/ModalHost';
import { ToastProvider } from './components/ui/Toast';
import { NavigatorProvider, useNavigator } from './navigation/Navigator';
import { ShortcutsProvider, useShortcuts } from './hooks/useShortcuts';
import CommandMenu from './components/ui/CommandMenu';
import ShortcutsHelp from './components/ui/ShortcutsHelp';
import { NotificationMetadata } from '../types/notifications';
import { ProjectsProvider } from './projects/ProjectContext';
import { useAppSettings } from './hooks/useAppSettings';
import { useTheme } from './hooks/useTheme';
import useLiveData from './hooks/useLiveData';
import LoadingScreen from './screens/LoadingScreen';
import { AppSettingsProvider } from './settings/AppSettingsContext';

const UI_IMPROVEMENTS_TASK_ID = 'f67e8921-b197-40c9-9154-e95db8f27deb';

function ServicesBootstrap() {
  const { init } = useLiveData();

  useEffect(() => { 
    init(); 
  }, [])

  return null;
}

function GlobalShortcutsBootstrap() {
  const { register } = useShortcuts();
  const nav = useNavigator();
  const { appSettings } = useAppSettings();

  const combos = appSettings.userPreferences.shortcuts;

  useEffect(() => {
    const unregisterNew = register({ id: 'new-task', comboKeys: combos.newTask, handler: () => nav.openModal({ type: 'task-create' }), description: 'New task' });
    const unregisterAddUiFeature = register({ id: 'add-ui-feature', comboKeys: combos.addUiFeature, handler: () => nav.openModal({ type: 'feature-create', taskId: UI_IMPROVEMENTS_TASK_ID }), description: 'Add feature to UI Improvements', scope: 'global' });
    return () => { unregisterNew(); unregisterAddUiFeature(); };
  }, [register, nav, combos.newTask, combos.addUiFeature]);

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

function MainAppShell() {
  return (
    <AppSettingsProvider>
      <ToastProvider>
        <ProjectsProvider>
          <NavigatorProvider>
            <ShortcutsProvider>
              <ServicesBootstrap />
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
    </AppSettingsProvider>
  );
}

function App() {
  const { initTheme } = useTheme();
  const [bootComplete, setBootComplete] = useState(false);

  useEffect(() => { initTheme(); }, [])

  const handleLoaded = useCallback(() => {
    setBootComplete(true);
  }, []);

  if (!bootComplete) {
    // Show loading screen first; it will load app settings and preferences via useAppSettings
    return <LoadingScreen onLoaded={handleLoaded} />;
  }

  return <MainAppShell />;
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
