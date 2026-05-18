import { useNavigate } from 'react-router-dom'
import { useProjects } from '../../../core/contexts/ProjectsContext'
import { useAuth } from '../../../core/contexts/AuthContext'
import { SHELL_TAB_DEFS, type ShellTabKey } from './shellTabDefs'

type Props = {
  projectId?: string
  activeTab?: ShellTabKey
}

/**
 * Minimal left rail — project selector + per-project tab list + disconnect.
 * Stub for web's full [`Sidebar`](../../../../../../../thefactory-overseer-web/src/ui/components/shell/Sidebar.tsx)
 * (collapsible, drag-reorder, group support, badge counts). Those lift in a
 * later §B.3.c milestone once the supporting `useBadgeCounts`, project icons,
 * and `ProjectManagerModal` ports land.
 */
export default function Sidebar({ projectId, activeTab }: Props) {
  const navigate = useNavigate()
  const { projects, activeProjectId, setActiveProjectId } = useProjects()
  const { clear } = useAuth()

  const visibleTabs = SHELL_TAB_DEFS.filter(
    (t) => !('hiddenInSidebar' in t && t.hiddenInSidebar),
  )
  const currentProjectId = projectId ?? activeProjectId

  return (
    <div className="w-56 flex flex-col border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="px-3 py-3 border-b border-gray-200 dark:border-zinc-800">
        <div className="text-xs uppercase tracking-wide opacity-60 mb-1">Projects</div>
        <ul className="flex flex-col gap-0.5">
          {projects.map((p) => {
            const selected = p.id === currentProjectId
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveProjectId(p.id)
                    navigate(`/projects/${p.id}/stories`)
                  }}
                  className={`w-full text-left rounded px-2 py-1 text-sm truncate ${
                    selected
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {p.title ?? p.id}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="px-3 py-3 flex-1 overflow-y-auto">
        <div className="text-xs uppercase tracking-wide opacity-60 mb-1">Tabs</div>
        <ul className="flex flex-col gap-0.5">
          {visibleTabs.map((t) => {
            const selected = t.key === activeTab
            return (
              <li key={t.key}>
                <button
                  type="button"
                  disabled={!currentProjectId}
                  onClick={() => navigate(`/projects/${currentProjectId}/${t.key}`)}
                  className={`w-full text-left flex items-center gap-2 rounded px-2 py-1 text-sm disabled:opacity-50 ${
                    selected
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : 'hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="opacity-70">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => void clear()}
          className="w-full text-left rounded px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800"
        >
          Disconnect
        </button>
      </div>
    </div>
  )
}
