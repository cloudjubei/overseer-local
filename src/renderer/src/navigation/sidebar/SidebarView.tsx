import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigator } from '../Navigator'
import { useProjectContext } from '../../contexts/ProjectContext'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { useProjectsGroups } from '../../contexts/ProjectsGroupsContext'
import { useNotifications } from '@renderer/hooks/useNotifications'
import { IconMenu, IconWarningTriangle } from '../../components/ui/icons/Icons'
import { hideScrollStyle } from '@renderer/utils/hideScrollStyle'
import { classNames } from '../utils'
import { NAV_ITEMS, GROUP_NAV_ITEMS, NavDef } from './constants'
import ProjectNavItem from './ProjectNavItem'
import GroupNavItem from './GroupNavItem'
import StaticNavItem from './StaticNavItem'
import Tooltip from '../../components/ui/Tooltip'
import { ProjectSpec } from 'thefactory-tools'

export type SidebarProps = {
  isMobile: boolean
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  mobileTriggerRef: React.MutableRefObject<HTMLButtonElement | null>
}

export default function SidebarView({
  isMobile,
  mobileOpen,
  setMobileOpen,
  mobileTriggerRef,
}: SidebarProps) {
  const { currentView, navigateView, openModal } = useNavigator()
  const { activeProjectId, projects, setActiveProjectId } = useProjectContext()
  const { isAppSettingsLoaded, appSettings, updateAppSettings } = useAppSettings()
  const { groups, activeGroupId, activeSelectionType, setActiveGroupId, setActiveSelectionType } =
    useProjectsGroups()
  const { getProjectBadgeState, getGroupBadgeState } = useNotifications()

  const [collapsed, setCollapsed] = useState<boolean>(appSettings.userPreferences.sidebarCollapsed)

  useEffect(() => {
    if (isAppSettingsLoaded) {
      setCollapsed(appSettings.userPreferences.sidebarCollapsed)
    }
  }, [isAppSettingsLoaded])

  useEffect(() => {
    if (!isAppSettingsLoaded) return
    if (collapsed === appSettings.userPreferences.sidebarCollapsed) return
    updateAppSettings({
      userPreferences: { ...appSettings.userPreferences, sidebarCollapsed: collapsed },
    })
  }, [collapsed])

  const handleProjectSwitch = (projectId: string) => {
    if (projectId === activeProjectId && activeSelectionType === 'project') return
    setActiveProjectId(projectId)
    setActiveSelectionType('project')
    setActiveGroupId(null)
    navigateView(currentView)
  }

  const handleGroupSelect = (groupId: string) => {
    setActiveSelectionType('group')
    setActiveGroupId(groupId)
    if (!['Home', 'Chat', 'Tools'].includes(currentView)) {
      navigateView('Home')
    }
  }

  const stCurrent =
    activeSelectionType === 'group' && activeGroupId
      ? getGroupBadgeState(activeGroupId)
      : getProjectBadgeState(activeProjectId)

  const activeRunsCurrentProject = stCurrent.agent_runs.running
  const agentsCompletedUnreadCurrentProject = stCurrent.agent_runs.unread
  const chatUnreadCurrentProject = stCurrent.chat_messages.unread
  const chatThinkingCurrentProject = stCurrent.chat_messages.thinking
  const gitIncomingCurrentProject = stCurrent.git_changes.incoming
  const gitUncommittedCurrentProject = stCurrent.git_changes.uncommitted

  const firstItemRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (mobileOpen) setTimeout(() => firstItemRef.current?.focus(), 0)
  }, [mobileOpen])

  const displayedNavItems = useMemo(() => {
    return activeSelectionType === 'group'
      ? GROUP_NAV_ITEMS
      : NAV_ITEMS.filter((n) => n.view !== 'Settings')
  }, [activeSelectionType])

  const activeIndex = useMemo(() => {
    const idx = displayedNavItems.findIndex((n) => n.view === currentView)
    return idx >= 0 ? idx : 0
  }, [currentView, displayedNavItems])

  const [focusIndex, setFocusIndex] = useState<number>(activeIndex)
  useEffect(() => setFocusIndex(activeIndex), [activeIndex])

  const onKeyDownList = useCallback(
    (e: React.KeyboardEvent) => {
      const max = displayedNavItems.length - 1
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusIndex((i) => (i >= max ? 0 : i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusIndex((i) => (i <= 0 ? max : i - 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setFocusIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setFocusIndex(max)
      }
    },
    [displayedNavItems],
  )

  const onActivate = useCallback(
    (view: NavDef['view']) => {
      navigateView(view)
      if (isMobile) {
        setMobileOpen(false)
        setTimeout(() => mobileTriggerRef.current?.focus(), 0)
      }
    },
    [navigateView, isMobile, setMobileOpen, mobileTriggerRef],
  )

  const effectiveCollapsed = isMobile ? false : collapsed

  // Filter out inactive projects (p.active === false) for sidebar display
  const activeProjects = useMemo(
    () => projects.filter((p) => (p as any).active !== false),
    [projects],
  )

  // Filter out groups where all member projects are inactive (no visible members)
  // Also only include active groups
  const activeGroups = useMemo(
    () =>
      groups.filter(
        (g) =>
          g.active !== false &&
          (g.projects || []).some((pid) => activeProjects.some((p) => p.id === pid)),
      ),
    [groups, activeProjects],
  )

  // Only MAIN groups "own" projects in the sidebar tree — SCOPE groups are flat
  // selectable rows and should not cause their projects to disappear from the
  // ungrouped root list.
  const groupedProjectIds = useMemo(() => {
    const ids = new Set<string>()
    for (const g of activeGroups) {
      if (g.type === 'SCOPE') continue
      if (g.projects) {
        for (const pid of g.projects) {
          ids.add(pid)
        }
      }
    }
    return ids
  }, [activeGroups])

  return (
    <aside
      className={`sidebar flex flex-col bg-sidebar dark:bg-sidebar-dark border-r border-sidebar-border dark:border-sidebar-border-dark view-transition z-40 transition-all duration-300 ${
        effectiveCollapsed ? 'w-[64px]' : 'w-[260px]'
      } ${isMobile && mobileOpen ? 'drawer-open' : ''}`}
      aria-label="Main navigation"
      data-collapsed={effectiveCollapsed ? 'true' : 'false'}
    >
      <div
        className={`flex items-center p-3 shrink-0 ${
          effectiveCollapsed ? 'justify-center' : 'justify-between'
        }`}
        aria-hidden
      >
        {!effectiveCollapsed && (
          <button className="sidebar-logo" onClick={() => onActivate('Home')} tabIndex={-1}>
            <div className="flex gap-3">
              <img className="nav-item__icon" src="resources/icon.png" alt="Overseer" />
              <span>Overseer</span>
            </div>
          </button>
        )}

        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className=" p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            tabIndex={-1}
          >
            <IconMenu className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav
        className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin overflow-x-hidden"
        style={hideScrollStyle}
      >
        <ul className="nav-list" role="list" onKeyDown={onKeyDownList}>
          {displayedNavItems.map((item, i) => (
            <StaticNavItem
              key={item.id}
              item={item}
              isActive={currentView === item.view}
              effectiveCollapsed={effectiveCollapsed}
              focusIndex={focusIndex}
              index={i}
              setFocusIndex={setFocusIndex}
              onActivate={onActivate}
              isFirst={i === 0}
              firstItemRef={firstItemRef}
              activeRunsCurrentProject={activeRunsCurrentProject}
              agentsCompletedUnreadCurrentProject={agentsCompletedUnreadCurrentProject}
              chatUnreadCurrentProject={chatUnreadCurrentProject}
              chatThinkingCurrentProject={chatThinkingCurrentProject}
              gitIncomingCurrentProject={gitIncomingCurrentProject}
              gitUncommittedCurrentProject={gitUncommittedCurrentProject}
            />
          ))}
        </ul>

        <div className="nav-sep" aria-hidden />

        {!effectiveCollapsed && (
          <div className="px-3" aria-hidden>
            <div
              style={{
                color: 'var(--text-secondary)',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span>Projects</span>
              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span>{activeProjects.length}</span>
                <button
                  className="btn-secondary"
                  style={{ padding: '0 8px', height: 24, fontSize: 12 }}
                  onClick={() => openModal({ type: 'projects-manage' })}
                >
                  Manage
                </button>
              </div>
            </div>
          </div>
        )}

        <ul className="nav-list" aria-label="Projects">
          {activeProjects.length == 0 && (
            <li className="nav-li">
              <div
                className={classNames('nav-item', effectiveCollapsed && 'nav-item--compact')}
                role="status"
              >
                <span className="nav-item__icon" aria-hidden>
                  <IconWarningTriangle />
                </span>
                {!effectiveCollapsed && <span className="nav-item__label">Failed to load</span>}
              </div>
            </li>
          )}

          {activeProjects
            .filter((p) => !groupedProjectIds.has(p.id))
            .map((p) => (
              <ProjectNavItem
                key={p.id}
                project={p}
                active={activeSelectionType === 'project' && activeProjectId === p.id}
                effectiveCollapsed={effectiveCollapsed}
                onSwitch={handleProjectSwitch}
              />
            ))}

          {!effectiveCollapsed &&
            activeGroups.map((g) => {
              const projectById = new Map(activeProjects.map((p) => [p.id, p]))
              const groupProjects = (g.projects || [])
                .map((pid) => projectById.get(pid))
                .filter(Boolean) as ProjectSpec[]

              return (
                <GroupNavItem
                  key={g.id}
                  group={g}
                  groupProjects={groupProjects}
                  isActiveGroup={activeSelectionType === 'group' && activeGroupId === g.id}
                  activeProjectId={activeProjectId}
                  activeSelectionType={activeSelectionType}
                  effectiveCollapsed={effectiveCollapsed}
                  onGroupSelect={handleGroupSelect}
                  onProjectSwitch={handleProjectSwitch}
                />
              )
            })}
        </ul>
      </nav>

      <div className="shrink-0" aria-label="Footer">
        <div className="nav-sep" aria-hidden />
        <ul className="nav-list" role="list" onKeyDown={onKeyDownList}>
          {NAV_ITEMS.filter((n) => n.view === 'Settings').map((item) => {
            const idx = NAV_ITEMS.findIndex((n) => n.view === item.view)

            return (
              <StaticNavItem
                key={idx}
                item={item}
                isActive={currentView === item.view}
                effectiveCollapsed={effectiveCollapsed}
                focusIndex={focusIndex}
                index={idx}
                setFocusIndex={setFocusIndex}
                onActivate={onActivate}
                isFirst={true}
                firstItemRef={firstItemRef}
                activeRunsCurrentProject={0}
                agentsCompletedUnreadCurrentProject={0}
                chatUnreadCurrentProject={0}
                chatThinkingCurrentProject={false}
                gitIncomingCurrentProject={0}
                gitUncommittedCurrentProject={false}
              />
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
