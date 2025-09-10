import { useEffect, useState, useCallback } from 'react';
import SidebarView from './navigation/SidebarView';
import { createRoot } from 'react-dom/client';
import ModalHost from './navigation/ModalHost';
import { ToastProvider } from './components/ui/Toast';
import { NavigatorProvider, useNavigator } from './navigation/Navigator';
import { ShortcutsBootstrap, ShortcutsProvider, useShortcuts } from './hooks/useShortcuts';
import CommandMenu from './components/ui/CommandMenu';
import ShortcutsHelp from './components/ui/ShortcutsHelp';
import { ProjectsProvider } from './projects/ProjectContext';
import { useTheme } from './hooks/useTheme';
import useLiveData from './hooks/useLiveData';
import LoadingScreen from './screens/LoadingScreen';
import { AppSettingsProvider } from './settings/AppSettingsContext';
import { NotificationClickHandler } from './hooks/useNotifications';

function ServicesBootstrap() {
  const { init } = useLiveData();

  useEffect(() => { 
    init(); 
  }, [])

  return null;
}

function App() {
  return (
    <AppSettingsProvider>
      <ToastProvider>
        <ProjectsProvider>
          <NavigatorProvider>
            <ShortcutsProvider>
              <ServicesBootstrap />
              <ShortcutsBootstrap />
              <NotificationClickHandler />
              <CommandMenu />
              <ShortcutsHelp />
              <MainApp />
            </ShortcutsProvider>
          </NavigatorProvider>
        </ProjectsProvider>
      </ToastProvider>
    </AppSettingsProvider>
  )
}

function MainApp() {
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

  return (
    <div className="flex h-full w-full overflow-hidden">
      <SidebarView />
      <ModalHost />
    </div>
  )
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />  );
}
