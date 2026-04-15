import { useEffect, useState, useCallback } from 'react'
import ModalHost from './navigation/ModalHost'
import { ToastProvider } from './components/ui/Toast'
import { NavigatorProvider } from './navigation/Navigator'
import { ShortcutsBootstrap, ShortcutsProvider } from './hooks/useShortcuts'
import CommandMenu from './components/ui/CommandMenu'
import ShortcutsHelp from './components/ui/ShortcutsHelp'
import { ProjectsGroupsProvider } from './contexts/ProjectsGroupsContext'
import { ProjectsProvider, useProjectContext } from './contexts/ProjectContext'
import { useTheme } from './hooks/useTheme'
import useLiveData from './hooks/useLiveData'
import LoadingScreen from './screens/LoadingScreen'
import { AppSettingsProvider, useAppSettings } from './contexts/AppSettingsContext'
import { NotificationClickHandler } from './hooks/useNotifications'
import { LLMConfigProvider } from './contexts/LLMConfigContext'
import { AgentsProvider } from './contexts/AgentsContext'
import { FilesProvider } from './contexts/FilesContext'
import { StoriesProvider } from './contexts/StoriesContext'
import { GitHubCredentialsProvider } from './contexts/GitHubCredentialsContext'
import { ChatsProvider } from './contexts/chats/ChatsProvider'
import { GitProvider } from './contexts/GitContext'
import { NotificationSoundBootstrap } from './hooks/useNotifications'
import { CostsProvider } from './contexts/CostsContext'
import MainView from './navigation/main/MainView'
import OnboardingView from './screens/OnboardingView'
import DiagnosticsOverlay from './components/ui/DiagnosticsOverlay'

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
        <ProjectsGroupsProvider>
          <ProjectsProvider>
            <StoriesProvider>
              <FilesProvider>
                <NavigatorProvider>
                  <ShortcutsProvider>
                    <LLMConfigProvider>
                      <GitHubCredentialsProvider>
                        <GitProvider>
                          <CostsProvider>
                            <ChatsProvider>
                              <AgentsProvider>
                                <ServicesBootstrap />
                                <ShortcutsBootstrap />
                                <NotificationClickHandler />
                                <NotificationSoundBootstrap />
                                <CommandMenu />
                                <ShortcutsHelp />
                                <MainApp />
                              </AgentsProvider>
                            </ChatsProvider>
                          </CostsProvider>
                        </GitProvider>
                      </GitHubCredentialsProvider>
                    </LLMConfigProvider>
                  </ShortcutsProvider>
                </NavigatorProvider>
              </FilesProvider>
            </StoriesProvider>
          </ProjectsProvider>
        </ProjectsGroupsProvider>
      </ToastProvider>
    </AppSettingsProvider>
  )
}

function MainApp() {
  const { initTheme } = useTheme()
  const { appSettings } = useAppSettings()
  const { isLoaded: isProjectsLoaded, projects } = useProjectContext()
  const [bootComplete, setBootComplete] = useState(false)

  useEffect(() => {
    initTheme()
  }, [])

  const handleLoaded = useCallback(() => {
    setBootComplete(true)
  }, [])

  if (!bootComplete || !isProjectsLoaded) {
    // Show loading screen first; it will load app settings and preferences via useAppSettings
    return <LoadingScreen onLoaded={handleLoaded} />
  }

  const needsOnboarding = projects.length === 0

  return (
    <div className="flex h-full w-full overflow-hidden">
      {needsOnboarding ? <OnboardingView /> : <MainView />}
      <ModalHost />
      <DiagnosticsOverlay enabled={!!appSettings.userPreferences.showDiagnosticsOverlay} />
    </div>
  )
}

export default App
