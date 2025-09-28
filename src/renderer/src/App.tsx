import { useEffect, useState, useCallback } from 'react'
import SidebarView from './navigation/SidebarView'
import ModalHost from './navigation/ModalHost'
import { ToastProvider } from './components/ui/Toast'
import { NavigatorProvider } from './navigation/Navigator'
import { ShortcutsBootstrap, ShortcutsProvider } from './hooks/useShortcuts'
import CommandMenu from './components/ui/CommandMenu'
import ShortcutsHelp from './components/ui/ShortcutsHelp'
import { ProjectsProvider } from './contexts/ProjectContext'
import { useTheme } from './hooks/useTheme'
import useLiveData from './hooks/useLiveData'
import LoadingScreen from './screens/LoadingScreen'
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import { NotificationClickHandler } from './hooks/useNotifications'
import { LLMConfigProvider } from './contexts/LLMConfigContext'
import { AgentsProvider } from './contexts/AgentsContext'
import { FilesProvider } from './contexts/FilesContext'
import { StoriesProvider } from './contexts/StoriesContext'
import { GitHubCredentialsProvider } from './contexts/GitHubCredentialsContext'
import { ChatsProvider } from './contexts/ChatsContext'

function ServicesBootstrap() {
  const { init } = useLiveData()

  useEffect(() => {
    init()
  }, [])

  return null
}

function App() {
  return (
    <AppSettingsProvider>
      <ToastProvider>
        <ProjectsProvider>
          <StoriesProvider>
            <FilesProvider>
              <NavigatorProvider>
                <ShortcutsProvider>
                  <LLMConfigProvider>
                    <GitHubCredentialsProvider>
                      <ChatsProvider>
                        <AgentsProvider>
                          <ServicesBootstrap />
                          <ShortcutsBootstrap />
                          <NotificationClickHandler />
                          <CommandMenu />
                          <ShortcutsHelp />
                          <MainApp />
                        </AgentsProvider>
                      </ChatsProvider>
                    </GitHubCredentialsProvider>
                  </LLMConfigProvider>
                </ShortcutsProvider>
              </NavigatorProvider>
            </FilesProvider>
          </StoriesProvider>
        </ProjectsProvider>
      </ToastProvider>
    </AppSettingsProvider>
  )
}

function MainApp() {
  const { initTheme } = useTheme()
  const [bootComplete, setBootComplete] = useState(false)

  useEffect(() => {
    initTheme()
  }, [])

  const handleLoaded = useCallback(() => {
    setBootComplete(true)
  }, [])

  if (!bootComplete) {
    // Show loading screen first; it will load app settings and preferences via useAppSettings
    return <LoadingScreen onLoaded={handleLoaded} />
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <SidebarView />
      <ModalHost />
    </div>
  )
}

export default App
