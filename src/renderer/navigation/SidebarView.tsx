import React, { useState } from 'react'
import { useNavigator } from './Navigator'
import { useProjectContext } from '../projects/ProjectContext'
import { ProjectManagerModal } from '../projects/ProjectManagerModal'

export type SidebarViewProps = {
  collapsed?: boolean
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ')
}

function useAccentClass(seed: string): string {
  // Stable but simple accent class selection based on id
  const n = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0)
  const i = n % 3
  switch (i) {
    case 0:
      return 'nav-accent-teal'
    case 1:
      return 'nav-accent-purple'
    case 2:
    default:
      return 'nav-accent-brand'
  }
}

export default function SidebarView({ collapsed }: SidebarViewProps) {
  const { currentView, navigateView } = useNavigator()
  const {
    isMain,
    activeProjectId,
    projects,
    loading,
    error,
    setActiveProjectId,
    switchToMainProject,
  } = useProjectContext()
  const [showManager, setShowManager] = useState(false)

  return (
    <aside className="sidebar" data-collapsed={collapsed ? 'true' : 'false'} aria-label="Primary Navigation">
      <nav className="nav">
        <ul className="nav-list" aria-label="Views">
          <li className="nav-li">
            <button
              className={classNames('nav-item nav-accent-brand', currentView === 'Home' && 'nav-item--active', collapsed && 'nav-item--compact')}
              aria-current={currentView === 'Home' ? 'page' : undefined}
              onClick={() => navigateView('Home')}
            >
              <span className="nav-item__icon" aria-hidden>🏠</span>
              {!collapsed && <span className="nav-item__label">Home</span>}
            </button>
          </li>
          <li className="nav-li">
            <button
              className={classNames('nav-item nav-accent-purple', currentView === 'Documents' && 'nav-item--active', collapsed && 'nav-item--compact')}
              aria-current={currentView === 'Documents' ? 'page' : undefined}
              onClick={() => navigateView('Documents')}
            >
              <span className="nav-item__icon" aria-hidden>📄</span>
              {!collapsed && <span className="nav-item__label">Documents</span>}
            </button>
          </li>
          <li className="nav-li">
            <button
              className={classNames('nav-item nav-accent-teal', currentView === 'Chat' && 'nav-item--active', collapsed && 'nav-item--compact')}
              aria-current={currentView === 'Chat' ? 'page' : undefined}
              onClick={() => navigateView('Chat')}
            >
              <span className="nav-item__icon" aria-hidden>💬</span>
              {!collapsed && <span className="nav-item__label">Chat</span>}
            </button>
          </li>
          <li className="nav-li">
            <button
              className={classNames('nav-item nav-accent-gray', currentView === 'Settings' && 'nav-item--active', collapsed && 'nav-item--compact')}
              aria-current={currentView === 'Settings' ? 'page' : undefined}
              onClick={() => navigateView('Settings')}
            >
              <span className="nav-item__icon" aria-hidden>⚙️</span>
              {!collapsed && <span className="nav-item__label">Settings</span>}
            </button>
          </li>
        </ul>

        <div className="nav-sep" />

        {/* Projects section */}
        {!collapsed && (
          <div className="px-3" aria-hidden>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>Projects</span>
              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span>{projects.length}</span>
                <button className="btn-secondary" style={{ padding: '0 8px', height: 24, fontSize: 12 }} onClick={() => setShowManager(true)}>Manage</button>
              </div>
            </div>
          </div>
        )}
        <ul className="nav-list" aria-label="Projects">
          {/* Main project */}
          <li className="nav-li">
            <button
              className={classNames('nav-item nav-accent-gray', isMain && 'nav-item--active', collapsed && 'nav-item--compact')}
              aria-current={isMain ? 'true' : undefined}
              onClick={() => switchToMainProject()}
              title="Main project"
            >
              <span className="nav-item__icon" aria-hidden>🗂️</span>
              {!collapsed && <span className="nav-item__label">Main project</span>}
            </button>
          </li>

          {/* Child projects */}
          {loading && (
            <li className="nav-li">
              <div className={classNames('nav-item', collapsed && 'nav-item--compact')}>
                <span className="nav-item__icon" aria-hidden>⏳</span>
                {!collapsed && <span className="nav-item__label">Loading projects…</span>}
              </div>
            </li>
          )}
          {error && !loading && (
            <li className="nav-li">
              <div className={classNames('nav-item', collapsed && 'nav-item--compact')} role="status">
                <span className="nav-item__icon" aria-hidden>⚠️</span>
                {!collapsed && <span className="nav-item__label">Failed to load</span>}
              </div>
            </li>
          )}
          {!loading && !error && projects.map((p) => {
            const active = activeProjectId === p.id
            const accent = useAccentClass(p.id)
            return (
              <li className="nav-li" key={p.id}>
                <button
                  className={classNames('nav-item', accent, active && 'nav-item--active', collapsed && 'nav-item--compact')}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setActiveProjectId(p.id)}
                  title={p.title}
                >
                  <span className="nav-item__icon" aria-hidden>📁</span>
                  {!collapsed && <span className="nav-item__label">{p.title}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      {showManager && <ProjectManagerModal onClose={() => setShowManager(false)} />}
    </aside>
  )
}
