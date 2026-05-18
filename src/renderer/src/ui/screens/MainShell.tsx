import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProjects } from '../../core/contexts/ProjectsContext'
import Sidebar from '../components/shell/Sidebar'
import ScreenErrorBoundary from '../components/shell/ScreenErrorBoundary'
import { SHELL_TAB_DEFS, isShellTabKey, type ShellTabKey } from '../components/shell/shellTabDefs'

/**
 * Per-project shell. Mirror of web's [`MainShell`](../../../../../../thefactory-overseer-web/src/App.tsx).
 * Sidebar on the left, the active tab's screen on the right. Per-tab screens
 * are stubs until §B.3.c lands each domain port — the structure (URL paths,
 * Sidebar selection, error boundary) is in place so each port becomes a
 * pure component swap.
 */
export default function MainShell() {
  const navigate = useNavigate()
  const { projectId, tab: tabParam } = useParams<{ projectId: string; tab: string }>()
  const { projects, activeProjectId, setActiveProjectId } = useProjects()

  const tab: ShellTabKey = isShellTabKey(tabParam) ? tabParam : 'stories'

  useEffect(() => {
    if (!projectId) return
    if (!projects.some((p) => p.id === projectId)) return
    if (projectId !== activeProjectId) setActiveProjectId(projectId)
  }, [projectId, projects, activeProjectId, setActiveProjectId])

  useEffect(() => {
    if (!projectId) return
    if (!isShellTabKey(tabParam)) navigate(`/projects/${projectId}/stories`, { replace: true })
  }, [projectId, tabParam, navigate])

  const screenLabel = SHELL_TAB_DEFS.find((t) => t.key === tab)?.label ?? tab

  return (
    <div className="flex flex-row w-full h-full overflow-hidden">
      <Sidebar projectId={projectId} activeTab={tab} />
      <div className="flex-1 min-w-0 overflow-hidden">
        <ScreenErrorBoundary key={tab} screen={screenLabel}>
          <TabStub tab={tab} />
        </ScreenErrorBoundary>
      </div>
    </div>
  )
}

function TabStub({ tab }: { tab: ShellTabKey }) {
  const label = SHELL_TAB_DEFS.find((t) => t.key === tab)?.label ?? tab
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 gap-2">
      <div className="text-lg font-medium">{label}</div>
      <p className="text-sm opacity-70 max-w-md text-center">
        Stub screen. The {label.toLowerCase()} domain port lands in a later §B.3.c milestone.
      </p>
    </div>
  )
}
