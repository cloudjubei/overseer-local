import { Navigate, Route, Routes } from 'react-router-dom'
import { Spinner, ToastProvider } from 'thefactory-ui/web'
import { AgentsProvider } from './core/contexts/AgentsContext'
import { ApiProvider } from './core/contexts/ApiContext'
import { AppSettingsProvider } from './core/contexts/AppSettingsContext'
import { AuthProvider, useAuth } from './core/contexts/AuthContext'
import { ChatsProvider } from './core/contexts/ChatsContext'
import { CostsProvider } from './core/contexts/CostsContext'
import { EntitiesProvider } from './core/contexts/EntitiesContext'
import { FilesProvider } from './core/contexts/FilesContext'
import { GitProvider } from './core/contexts/GitContext'
import { GitCredentialsProvider } from './core/contexts/GitCredentialsContext'
import { IngestionProvider } from './core/contexts/IngestionContext'
import { LLMConfigsProvider } from './core/contexts/LLMConfigsContext'
import { LiveDataProvidersProvider } from './core/contexts/LiveDataProvidersContext'
import { OverseerProvider } from './core/contexts/OverseerContext'
import { ProjectsProvider } from './core/contexts/ProjectsContext'
import { ProjectsGroupsProvider } from './core/contexts/ProjectsGroupsContext'
import { StoriesProvider } from './core/contexts/StoriesContext'
import { TestsProvider } from './core/contexts/TestsContext'
import { ToolsProvider } from './core/contexts/ToolsContext'
import { WebSearchKeysProvider } from './core/contexts/WebSearchKeysContext'
import AuthedRoot from './ui/screens/AuthedRoot'
import MainShell from './ui/screens/MainShell'
import LoginScreen from './screens/LoginScreen'

export default function App() {
  return (
    <AuthProvider>
      <ApiProvider>
        <ToastProvider>
          <AuthGate />
        </ToastProvider>
      </ApiProvider>
    </AuthProvider>
  )
}

function AuthGate() {
  const { ready, baseUrl, token } = useAuth()
  if (!ready) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Spinner size={28} />
      </div>
    )
  }
  if (!baseUrl || !token) return <LoginScreen />
  return <ConnectedShell />
}

/**
 * Post-auth provider tree, mirroring the order in
 * [thefactory-overseer-web/src/App.tsx](../../../../thefactory-overseer-web/src/App.tsx). Routes
 * mirror web's URL shape (`/projects/:projectId/:tab` etc.); per-tab screens
 * are currently stubs (`MainShell` → `TabStub`) until §B.3.c lifts each
 * domain.
 */
function ConnectedShell() {
  return (
    <AppSettingsProvider>
      <LLMConfigsProvider>
        <GitCredentialsProvider>
          <WebSearchKeysProvider>
            <OverseerProvider>
              <ProjectsProvider>
                <ProjectsGroupsProvider>
                  <StoriesProvider>
                    <FilesProvider>
                      <GitProvider>
                        <CostsProvider>
                          <ChatsProvider>
                            <AgentsProvider>
                              <TestsProvider>
                                <ToolsProvider>
                                  <EntitiesProvider>
                                    <LiveDataProvidersProvider>
                                      <IngestionProvider>
                                        <div className="flex h-full w-full overflow-hidden">
                                          <Routes>
                                            <Route path="/" element={<AuthedRoot />} />
                                            <Route
                                              path="/projects/:projectId/stories/:storyId"
                                              element={<MainShell />}
                                            />
                                            <Route
                                              path="/projects/:projectId/chat/:contextKey"
                                              element={<MainShell />}
                                            />
                                            <Route
                                              path="/projects/:projectId/files/*"
                                              element={<MainShell />}
                                            />
                                            <Route
                                              path="/projects/:projectId/:tab"
                                              element={<MainShell />}
                                            />
                                            <Route
                                              path="/projects/:projectId"
                                              element={<MainShell />}
                                            />
                                            <Route path="*" element={<Navigate to="/" replace />} />
                                          </Routes>
                                        </div>
                                      </IngestionProvider>
                                    </LiveDataProvidersProvider>
                                  </EntitiesProvider>
                                </ToolsProvider>
                              </TestsProvider>
                            </AgentsProvider>
                          </ChatsProvider>
                        </CostsProvider>
                      </GitProvider>
                    </FilesProvider>
                  </StoriesProvider>
                </ProjectsGroupsProvider>
              </ProjectsProvider>
            </OverseerProvider>
          </WebSearchKeysProvider>
        </GitCredentialsProvider>
      </LLMConfigsProvider>
    </AppSettingsProvider>
  )
}
