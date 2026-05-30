import { useEffect, useRef } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import type { ReactNode } from 'react'
import { CodeBlockThemeProvider } from 'thefactory-ui/headless'
import { AgentsProvider } from 'thefactory-ui/headless'
import { ApiProvider } from '@core/contexts/ApiContext'
import { AppSettingsProvider, useAppSettings } from '@core/contexts/AppSettingsContext'
import { AuthProvider, useAuth } from '@core/contexts/AuthContext'
import { ChatsProvider } from 'thefactory-ui/headless'
import { CostsProvider } from 'thefactory-ui/headless'
import { EntitiesProvider } from 'thefactory-ui/headless'
import { FilesProvider } from 'thefactory-ui/headless'
import { GitProvider, useGit } from 'thefactory-ui/headless'
import { localStorageAdapter } from './core/storage/localStorageAdapter'
import { GitCredentialErrorModal } from 'thefactory-ui/web'
import { GitCredentialsProvider } from 'thefactory-ui/headless'
import { IngestionProvider } from 'thefactory-ui/headless'
import { LiveDataProvidersProvider } from 'thefactory-ui/headless'
import { LLMConfigsProvider } from '@core/contexts/LLMConfigsContext'
import { NativeDictationTriggerContext, OverseerProvider } from 'thefactory-ui/headless'
import { macOsDictationTrigger } from './core/speech/macOsDictationTrigger'
import { ProjectsProvider, useProjects } from 'thefactory-ui/headless'
import { ProjectsGroupsProvider, useProjectsGroups } from 'thefactory-ui/headless'
import { TemplatesProvider } from 'thefactory-ui/headless'
import { StoriesProvider } from 'thefactory-ui/headless'
import { TestsProvider } from 'thefactory-ui/headless'
import { ToolsProvider } from 'thefactory-ui/headless'
import { WebSearchKeysProvider } from 'thefactory-ui/headless'
import { ShortcutsProvider } from '@core/shortcuts/ShortcutsContext'
import { CommandMenu } from 'thefactory-ui/web'
import { ShortcutsHelp } from 'thefactory-ui/web'
import { DiagnosticsOverlay } from "thefactory-ui/web"
import DisconnectedBanner from '@ui/components/shell/DisconnectedBanner'
import EventNotifier from '@ui/components/shell/EventNotifier'
import { ScreenErrorBoundary } from 'thefactory-ui/web'
import Sidebar from '@ui/components/shell/Sidebar'
import {
  isGroupTabKey,
  isShellTabKey,
  SHELL_TAB_DEFS,
  type GroupTabKey,
  type ShellTabKey,
} from 'thefactory-ui/headless'
import { useApplyTheme } from '@ui/hooks/useApplyTheme'
import AgentsView from '@ui/screens/AgentsView'
import ChatView from '@ui/screens/ChatView'
import FilesView from '@ui/screens/FilesView'
import GroupChatView from '@ui/screens/GroupChatView'
import GroupHomeView from '@ui/screens/GroupHomeView'
import GitView from '@ui/screens/GitView'
import LiveDataView from '@ui/screens/LiveDataView'
import { LoadingScreen, ProjectTimelineView, WelcomeView } from 'thefactory-ui/web'
import LoginScreen from '@ui/screens/LoginScreen'
import SettingsView from '@ui/screens/SettingsView'
import StoriesView from '@ui/screens/StoriesView'
import ProjectAppTab from '@ui/screens/ProjectAppTab'
import TestsView from '@ui/screens/TestsView'
import ToolsView from '@ui/screens/ToolsView'

/**
 * Desktop's `App.tsx`. Mirrors [web's same-named file](../../../../thefactory-overseer-web/src/App.tsx)
 * structurally — same provider order, same Routes shape, same `MainShell` /
 * `GroupShell` / `AuthedRoot` decomposition. Differences:
 *
 * - No `BrowserRouter` here (it's a `HashRouter` mounted in `main.tsx` because
 *   the renderer loads from `file://` in production).
 * - No `/auth/github/callback` route — desktop's `LoginScreen` is paste-and-
 *   store against `safeStorage` IPC; the OAuth callback flow is web-only.
 * - `BackendGate` is a layout route hosting all data providers; `LoginScreen`
 *   lives outside it. Web doesn't need this — its `baseUrl` is a build-time
 *   constant and its `token` loads synchronously from `localStorage`, so its
 *   data providers can mount immediately. Desktop's auth state is async
 *   (safeStorage IPC), so the gate enforces the invariant that no data
 *   provider mounts (and so no HTTP call fires) before the SDK is configured.
 */
function BackendGate() {
  const { ready, baseUrl, token } = useAuth()
  if (!ready) return <LoadingScreen label="Initializing…" />
  if (!baseUrl || !token) return <Navigate to="/login" replace />
  return (
    <LLMConfigsProvider>
      <GitCredentialsProvider>
        <WebSearchKeysProvider>
          <OverseerProvider>
            <ProjectsProvider>
              <ProjectsGroupsProvider>
                <TemplatesProvider>
                <StoriesProvider>
                  <FilesProvider>
                    <GitProvider storage={localStorageAdapter}>
                      <CostsProvider>
                        <ChatsProvider>
                          <AgentsProvider>
                            <TestsProvider>
                              <ToolsProvider>
                                <EntitiesProvider>
                                  <LiveDataProvidersProvider>
                                    <IngestionProvider>
                                      <EventNotifier />
                                      <DiagnosticsOverlay />
                                      <ShortcutsHelp />
                                      <CommandMenu />
                                      <GitCredentialErrorModalMount />
                                      <Outlet />
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
                </TemplatesProvider>
              </ProjectsGroupsProvider>
            </ProjectsProvider>
          </OverseerProvider>
        </WebSearchKeysProvider>
      </GitCredentialsProvider>
    </LLMConfigsProvider>
  )
}

function MainShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    projectId,
    tab: tabParam,
    storyId,
    contextKey,
  } = useParams<{
    projectId: string
    tab: string
    storyId: string
    contextKey: string
  }>()
  const { projects, activeProjectId, setActiveProjectId } = useProjects()

  const isFilesPath =
    !!projectId &&
    (() => {
      const base = `/projects/${projectId}/files`
      return location.pathname === base || location.pathname.startsWith(`${base}/`)
    })()
  const tab: ShellTabKey = storyId
    ? 'stories'
    : contextKey
      ? 'chat'
      : isFilesPath
        ? 'files'
        : isShellTabKey(tabParam)
          ? tabParam
          : 'stories'

  // Track the URL's projectId across renders. Only sync URL → state when
  // the URL itself just changed (e.g. browser back/forward or deep link),
  // NOT when `activeProjectId` changed via a sidebar click — in that case
  // the click already updated state and called `navigate()`, and the URL
  // takes an extra render to reflect the new path. Without this guard the
  // URL-sync effect fires on that intermediate render with the OLD URL,
  // reverting `activeProjectId` back to the previous project and locking
  // every project-dependent context into an oscillation.
  const lastUrlProjectIdRef = useRef(projectId)
  useEffect(() => {
    const urlChanged = lastUrlProjectIdRef.current !== projectId
    lastUrlProjectIdRef.current = projectId
    if (!projectId) return
    if (!urlChanged) return
    if (!projects.some((p) => p.id === projectId)) return
    if (projectId !== activeProjectId) setActiveProjectId(projectId)
  }, [projectId, projects, activeProjectId, setActiveProjectId])

  useEffect(() => {
    if (!projectId || storyId || contextKey || isFilesPath) return
    if (!isShellTabKey(tabParam)) navigate(`/projects/${projectId}/stories`, { replace: true })
  }, [projectId, tabParam, storyId, contextKey, isFilesPath, navigate])

  const screenLabel = SHELL_TAB_DEFS.find((t) => t.key === tab)?.label ?? tab

  return (
    <div className="flex flex-row w-full h-full overflow-hidden">
      <Sidebar projectId={projectId} activeTab={tab} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="flex-1 min-h-0">
          <ScreenErrorBoundary key={tab} screen={screenLabel}>
            {tab === 'stories' && <StoriesView />}
            {tab === 'app' && <ProjectAppTab />}
            {tab === 'chat' && <ChatView />}
            {tab === 'agents' && <AgentsView />}
            {tab === 'files' && <FilesView />}
            {tab === 'git' && <GitView />}
            {tab === 'tests' && <TestsView />}
            {tab === 'tools' && <ToolsView />}
            {tab === 'live-data' && <LiveDataView />}
            {tab === 'timeline' && <ProjectTimelineView />}
            {tab === 'settings' && <SettingsView />}
          </ScreenErrorBoundary>
        </div>
      </div>
    </div>
  )
}

function GroupShell() {
  const {
    groupId,
    tab: tabParam,
    contextKey,
  } = useParams<{
    groupId: string
    tab: string
    contextKey: string
  }>()
  const { setActiveGroupId } = useProjectsGroups()
  const navigate = useNavigate()

  useEffect(() => {
    if (groupId) setActiveGroupId(groupId)
  }, [groupId, setActiveGroupId])

  const tab: GroupTabKey = contextKey ? 'chat' : isGroupTabKey(tabParam) ? tabParam : 'home'

  useEffect(() => {
    if (!groupId || contextKey) return
    if (!isGroupTabKey(tabParam)) navigate(`/groups/${groupId}/home`, { replace: true })
  }, [groupId, tabParam, contextKey, navigate])

  return (
    <div className="flex flex-row w-full h-full overflow-hidden">
      <Sidebar activeGroupTab={tab} activeGroupId={groupId} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="flex-1 min-h-0">
          <ScreenErrorBoundary key={tab} screen={`Group · ${tab}`}>
            {tab === 'home' && <GroupHomeView />}
            {tab === 'chat' && <GroupChatView />}
            {tab === 'tools' && <ToolsView />}
          </ScreenErrorBoundary>
        </div>
      </div>
    </div>
  )
}

function AuthedRoot() {
  const { isLoaded, loadError, projects, activeProjectId } = useProjects()

  if (!isLoaded) return <LoadingScreen label="Loading your projects…" />
  if (loadError)
    return <LoadingScreen label="Could not reach the backend" error={loadError.message} />
  if (projects.length === 0) return <WelcomeView />

  const target = activeProjectId ?? projects[0].id
  return <Navigate to={`/projects/${target}/stories`} replace />
}

function ThemeApplier() {
  useApplyTheme()
  return null
}

function CodeBlockThemeBridge({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings()
  return (
    <CodeBlockThemeProvider value={settings.userPreferences.codeBlockTheme}>
      {children}
    </CodeBlockThemeProvider>
  )
}

export default function App() {
  return (
    <NativeDictationTriggerContext.Provider value={macOsDictationTrigger}>
    <AppSettingsProvider>
      <ThemeApplier />
      <CodeBlockThemeBridge>
      <ShortcutsProvider>
        <AuthProvider>
          <ApiProvider>
            <div className="flex flex-col h-full w-full overflow-hidden">
              <DisconnectedBanner />
              <div className="flex flex-1 min-h-0 overflow-hidden">
                <Routes>
                  <Route path="/login" element={<LoginScreen />} />
                  <Route element={<BackendGate />}>
                    <Route path="/" element={<AuthedRoot />} />
                    <Route path="/groups/:groupId/chat/:contextKey" element={<GroupShell />} />
                    <Route path="/groups/:groupId/:tab" element={<GroupShell />} />
                    <Route path="/groups/:groupId" element={<GroupShell />} />
                    <Route path="/projects/:projectId/stories/:storyId" element={<MainShell />} />
                    <Route path="/projects/:projectId/chat/:contextKey" element={<MainShell />} />
                    <Route path="/projects/:projectId/files/*" element={<MainShell />} />
                    <Route path="/projects/:projectId/:tab" element={<MainShell />} />
                    <Route path="/projects/:projectId" element={<MainShell />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
          </ApiProvider>
        </AuthProvider>
      </ShortcutsProvider>
      </CodeBlockThemeBridge>
    </AppSettingsProvider>
    </NativeDictationTriggerContext.Provider>
  )
}

function GitCredentialErrorModalMount() {
  const navigate = useNavigate()
  const { activeProjectId } = useProjects()
  const { credentialError, clearCredentialError } = useGit()
  return (
    <GitCredentialErrorModal
      isOpen={credentialError !== null}
      onClose={clearCredentialError}
      onOpenSettings={() => {
        clearCredentialError()
        if (activeProjectId) {
          navigate(`/projects/${activeProjectId}/settings?tab=github`)
        }
      }}
      op={credentialError?.op}
      message={credentialError?.message}
      repoUrl={credentialError?.repoUrl}
    />
  )
}
