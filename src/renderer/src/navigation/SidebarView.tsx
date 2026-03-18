import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FilesView from '../screens/FilesView'
import SettingsView from '../screens/SettingsView'
import ChatView from '../screens/ChatView'
import StoriesView from '../screens/StoriesView'
import LiveDataView from '../screens/LiveDataView'
import ProjectTimelineView from '../screens/ProjectTimelineView'
import ToolsScreen from '../screens/ToolsView'
import TestsView from '../screens/TestsView'
import GitView from '../screens/GitView'
import { useNavigator } from './Navigator'
import Tooltip from '../components/ui/Tooltip'
import { MAIN_PROJECT, useProjectContext } from '../contexts/ProjectContext'
import { useAppSettings } from '../contexts/AppSettingsContext'
import NotificationBadge, { getBadgeColorClass } from '../components/stories/NotificationBadge'
import { ProjectSpec } from 'thefactory-tools'
import {
  IconHome,
  IconFiles,
  IconChat,
  IconRobot,
  IconAntenna,
  IconSettings,
  IconWarningTriangle,
  IconMenu,
  IconChevron,
  IconTimeline,
  IconToolbox,
  IconTests,
  IconBranch,
} from '../components/ui/icons/Icons'
import { renderProjectIcon } from '@renderer/screens/projects/projectIcons'
import { NavigationView } from '@renderer/types'
import { hideScrollStyle } from '@renderer/utils/hideScrollStyle'
import { useProjectsGroups } from '../contexts/ProjectsGroupsContext'
import SpinnerWithDot from '../components/ui/SpinnerWithDot'
import { useNotifications } from '@renderer/hooks/useNotifications'

export type SidebarProps = {}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ')
}

type NavDef = {
  id: string
  label: string
  view: NavigationView
  icon: React.ReactNode
  accent?: 'brand' | 'purple' | 'teal' | 'gray'
}

const NAV_ITEMS: NavDef[] = [
  { id: 'home', label: 'Home', view: 'Home', icon: <IconHome />, accent: 'brand' },
  {
    id: 'files',
    label: 'Files',
    view: 'Files',
    icon: <IconFiles />,
    accent: 'purple',
  },
  { id: 'chats', label: 'Chat', view: 'Chat', icon: <IconChat />, accent: 'teal' },
  {
    id: 'agents',
    label: 'Agents',
    view: 'Agents',
    icon: <IconRobot />,
    accent: 'teal',
  },
  {
    id: 'git',
    label: 'Git',
    view: 'Git',
    icon: <IconBranch />,
    accent: 'purple',
  },
  {
    id: 'tests',
    label: 'Tests',
    view: 'Tests',
    icon: <IconTests />,
    accent: 'teal',
  },
  {
    id: 'live-data',
    label: 'Live Data',
    view: 'LiveData',
    icon: <IconAntenna />,
    accent: 'brand',
  },
  {
    id: 'project-timeline',
    label: 'Timeline',
    view: 'ProjectTimeline',
    icon: <IconTimeline />,
    accent: 'purple',
  },
  {
    id: 'tools',
    label: 'Tools',
    view: 'Tools',
    icon: <IconToolbox />,
    accent: 'brand',
  },
  {
    id: 'settings',
    label: 'Settings',
    view: 'Settings',
    icon: <IconSettings />,
    accent: 'gray',
  },
]

const GROUP_NAV_ITEMS: NavDef[] = [
  { id: 'home', label: 'Home', view: 'Home', icon: <IconHome />, accent: 'brand' },
  { id: 'chats', label: 'Chat', view: 'Chat', icon: <IconChat />, accent: 'teal' },
  { id: 'tools', label: 'Tools', view: 'Tools', icon: <IconToolbox />, accent: 'brand' },
]

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const m = window.matchMedia(query)
    const onChange = () => setMatches(m.matches)
    if (m.addEventListener) m.addEventListener('change', onChange)
    else m.addListener(onChange)
    setMatches(m.matches)
    return () => {
      if (m.removeEventListener) m.removeEventListener('change', onChange)
      else m.removeListener(onChange)
    }
  }, [query])
  return matches
}

function useAccentClass(seed: string, isMain: boolean): string {
  if (isMain) {
    return 'nav-item nav-accent-gray'
  }
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

export default function SidebarView({}: SidebarProps) {
  const { currentView, navigateView, openModal } = useNavigator()
  const { activeProjectId, projects, setActiveProjectId } = useProjectContext()
  const { isAppSettingsLoaded, appSettings, updateAppSettings } = useAppSettings()
  const { groups, activeGroupId, activeSelectionType, setActiveGroupId, setActiveSelectionType } =
    useProjectsGroups()
  const { isBadgeEnabled, isGitBadgeSubToggleEnabled, getProjectBadgeState, getGroupBadgeState } =
    useNotifications()

  const [collapsed, setCollapsed] = useState<boolean>(appSettings.userPreferences.sidebarCollapsed)
  const chatBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.chat_messages
  const agentBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.agent_runs
  const gitBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.git_changes

  const chatColorClass = getBadgeColorClass(chatBadgeColor)
  const agentColorClass = getBadgeColorClass(agentBadgeColor, true)
  const gitColorClass = getBadgeColorClass(gitBadgeColor)

  useEffect(() => {
    if (isAppSettingsLoaded) {
      setCollapsed(appSettings.userPreferences.sidebarCollapsed)
    }
  }, [isAppSettingsLoaded])
  useEffect(() => {
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

  const isMobile = useMediaQuery('(max-width: 768px)')
  const [mobileOpen, setMobileOpen] = useState<boolean>(false)
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null)
  const firstItemRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

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
    [navigateView, isMobile],
  )

  const renderedView = useMemo(() => {
    if (currentView === 'Files')
      return (
        <div key="Files" className="flex flex-col flex-1 min-h-0 view-transition">
          <FilesView />
        </div>
      )
    if (currentView === 'Settings')
      return (
        <div key="Settings" className="flex flex-col flex-1 min-h-0 view-transition">
          <SettingsView />
        </div>
      )
    if (currentView === 'Chat')
      return (
        <div key="Chat" className="flex flex-col flex-1 min-h-0 view-transition">
          <ChatView />
        </div>
      )
    if (currentView === 'Git')
      return (
        <div key="Git" className="flex flex-col flex-1 min-h-0 view-transition">
          <GitView />
        </div>
      )
    if (currentView === 'Tests')
      return (
        <div key="Tests" className="flex flex-col flex-1 min-h-0 view-transition">
          <TestsView />
        </div>
      )
    if (currentView === 'LiveData')
      return (
        <div key="LiveData" className="flex flex-col flex-1 min-h-0 view-transition">
          <LiveDataView />
        </div>
      )
    if (currentView === 'ProjectTimeline')
      return (
        <div key="ProjectTimeline" className="flex flex-col flex-1 min-h-0 view-transition">
          <ProjectTimelineView />
        </div>
      )
    if (currentView === 'Tools')
      return (
        <div key="Tools" className="flex flex-col flex-1 min-h-0 view-transition">
          <ToolsScreen />
        </div>
      )
    return (
      <div key="Home" className="flex flex-col flex-1 min-h-0 view-transition">
        <StoriesView />
      </div>
    )
  }, [currentView])

  const isMainProject = (id?: string) => id === MAIN_PROJECT
  const effectiveCollapsed = isMobile ? false : collapsed

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Filter out inactive projects (p.active === false) for sidebar display
  const activeProjects = useMemo(
    () => projects.filter((p) => (p as any).active !== false),
    [projects],
  )

  // Filter out groups where all member projects are inactive (no visible members)
  // Also only include active groups, and exclude SCOPE groups from main hierarchy
  const activeGroups = useMemo(
    () =>
      groups.filter(
        (g) =>
          g.active !== false &&
          g.type !== 'SCOPE' &&
          (g.projects || []).some((pid) => activeProjects.some((p) => p.id === pid)),
      ),
    [groups, activeProjects],
  )

  useEffect(() => {
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = { ...prev }
      for (const g of activeGroups) {
        if (!(g.id in next)) next[g.id] = false
      }
      const validIds = new Set(activeGroups.map((g) => g.id))
      for (const k of Object.keys(next)) {
        if (!validIds.has(k)) delete next[k]
      }
      return next
    })
  }, [activeGroups])

  const groupedProjectIds = useMemo(() => {
    const ids = new Set<string>()
    for (const g of activeGroups) {
      if (g.projects) {
        for (const pid of g.projects) {
          ids.add(pid)
        }
      }
    }
    return ids
  }, [activeGroups])

  const cap99 = (n: number) => (n > 99 ? '99+' : `${n}`)

  const renderProjectItem = (p: ProjectSpec) => {
    const active = activeSelectionType === 'project' && p.id === activeProjectId
    const accent = useAccentClass(p.id, isMainProject(p.id))
    const st = getProjectBadgeState(p.id)
    const activeRuns = st.agent_runs.running
    const agentsCompletedUnread = st.agent_runs.unread
    const chatUnread = st.chat_messages.unread
    const thinking = st.chat_messages.thinking
    const gitIncoming = st.git_changes.incoming
    const gitUncommitted = st.git_changes.uncommitted
    const iconKey = p.metadata?.icon || (isMainProject(p.id) ? 'collection' : 'folder')
    const projectIcon = renderProjectIcon(iconKey)

    const showAgents = isBadgeEnabled('agent_runs') && activeRuns > 0 && !active
    const showAgentsCompleted = isBadgeEnabled('agent_runs') && agentsCompletedUnread > 0 && !active
    const showChat = isBadgeEnabled('chat_messages') && (chatUnread > 0 || thinking) && !active

    const gitBadgesEnabled = isBadgeEnabled('git_changes') && !active
    const showGitIncoming =
      gitBadgesEnabled && isGitBadgeSubToggleEnabled('incoming_commits') && gitIncoming > 0
    const showGitUncommitted =
      gitBadgesEnabled && isGitBadgeSubToggleEnabled('uncommitted_changes') && gitUncommitted

    const hasAnyBadge =
      showAgents || showAgentsCompleted || showChat || showGitIncoming || showGitUncommitted

    const Btn = (
      <button
        type="button"
        onClick={() => handleProjectSwitch(p.id)}
        className={classNames(
          'nav-item flex-1',
          accent,
          active && 'nav-item--active',
          effectiveCollapsed && 'nav-item--compact',
        )}
        title={p.title}
        aria-current={active ? 'page' : undefined}
      >
        <span className="nav-item__icon" aria-hidden>
          {projectIcon}
        </span>
        {!effectiveCollapsed && <span className="nav-item__label flex-1 text-left">{p.title}</span>}

        {hasAnyBadge && (
          <span
            className={classNames(
              'nav-item__badges',
              effectiveCollapsed && 'nav-item__badges--compact',
            )}
            aria-hidden
          >
            {showAgents && (
              <NotificationBadge
                className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                text={`${activeRuns}`}
                tooltipLabel={`${activeRuns} running agents`}
                isInformative
                colorClass={agentColorClass}
              />
            )}
            {showAgentsCompleted && (
              <NotificationBadge
                className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                text={cap99(agentsCompletedUnread)}
                tooltipLabel={`${agentsCompletedUnread} completed agent runs`}
                colorClass={agentColorClass}
              />
            )}
            {showChat && thinking ? (
              <SpinnerWithDot
                size={effectiveCollapsed ? 14 : 16}
                showDot={chatUnread > 0}
                dotTitle={chatUnread > 0 ? `${chatUnread} unread chats` : undefined}
                dotColorClass={chatColorClass}
              />
            ) : showChat && chatUnread > 0 ? (
              <NotificationBadge
                className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                text={cap99(chatUnread)}
                tooltipLabel={`${chatUnread} unread chats`}
                colorClass={chatColorClass}
              />
            ) : null}
            {showGitIncoming && (
              <NotificationBadge
                className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                text={`${gitIncoming}↓`}
                tooltipLabel={`${gitIncoming} incoming commits`}
                colorClass={gitColorClass}
              />
            )}
            {showGitUncommitted && (
              <NotificationBadge
                className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                text={`*`}
                tooltipLabel={`Uncommitted changes`}
                colorClass={gitColorClass}
              />
            )}
          </span>
        )}
      </button>
    )

    return (
      <li key={p.id} className="nav-li">
        {effectiveCollapsed ? (
          <Tooltip content={p.title} placement="right">
            {Btn}
          </Tooltip>
        ) : (
          Btn
        )}
      </li>
    )
  }

  const Aside = (
    <aside
      className={`sidebar flex flex-col bg-sidebar dark:bg-sidebar-dark border-r border-sidebar-border dark:border-sidebar-border-dark view-transition z-40 transition-all duration-300 ${
        effectiveCollapsed ? 'w-[64px]' : 'w-[260px]'
      }`}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-between p-3 shrink-0" aria-hidden>
        <button
          className="sidebar-logo"
          onClick={() => onActivate('Home')}
          tabIndex={-1}
          style={effectiveCollapsed ? { width: '100%', justifyContent: 'center' } : {}}
        >
          <img src="icon.png" alt="Overseer" />
          {!effectiveCollapsed && <span>Overseer</span>}
        </button>

        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
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
          {displayedNavItems.map((item, i) => {
            const isActive = currentView === item.view
            const isFirst = i === 0
            const ref = isFirst ? firstItemRef : null

            const BtnBadges = () => {
              if (item.view === 'Agents' && isBadgeEnabled('agent_runs')) {
                const parts: React.ReactNode[] = []
                if (activeRunsCurrentProject > 0) {
                  parts.push(
                    <NotificationBadge
                      key="agent-running"
                      className={
                        effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''
                      }
                      text={`${activeRunsCurrentProject}`}
                      tooltipLabel={`${activeRunsCurrentProject} running agents`}
                      isInformative
                      colorClass={agentColorClass}
                    />,
                  )
                }
                if (agentsCompletedUnreadCurrentProject > 0) {
                  parts.push(
                    <NotificationBadge
                      key="agent-unread"
                      className={
                        effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''
                      }
                      text={cap99(agentsCompletedUnreadCurrentProject)}
                      tooltipLabel={`${agentsCompletedUnreadCurrentProject} completed agent runs`}
                      colorClass={agentColorClass}
                    />,
                  )
                }
                return parts.length ? <>{parts}</> : null
              }
              if (item.view === 'Git' && isBadgeEnabled('git_changes')) {
                const parts: React.ReactNode[] = []

                if (
                  isGitBadgeSubToggleEnabled('incoming_commits') &&
                  gitIncomingCurrentProject > 0
                ) {
                  parts.push(
                    <NotificationBadge
                      key="git-incoming"
                      className={
                        effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''
                      }
                      text={`${gitIncomingCurrentProject}↓`}
                      tooltipLabel={`${gitIncomingCurrentProject} incoming commits`}
                      colorClass={gitColorClass}
                    />,
                  )
                }

                if (
                  isGitBadgeSubToggleEnabled('uncommitted_changes') &&
                  gitUncommittedCurrentProject
                ) {
                  parts.push(
                    <NotificationBadge
                      key="git-uncommitted"
                      className={
                        effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''
                      }
                      text={`*`}
                      tooltipLabel={`Uncommitted changes`}
                      colorClass={gitColorClass}
                    />,
                  )
                }

                return parts.length ? <>{parts}</> : null
              }
              if (item.view === 'Chat' && isBadgeEnabled('chat_messages')) {
                const parts: React.ReactNode[] = []
                if (chatThinkingCurrentProject) {
                  parts.push(
                    <SpinnerWithDot
                      key="chat-thinking"
                      size={effectiveCollapsed ? 14 : 16}
                      showDot={chatUnreadCurrentProject > 0}
                      dotTitle={
                        chatUnreadCurrentProject > 0
                          ? `${chatUnreadCurrentProject} unread chats`
                          : undefined
                      }
                      dotColorClass={chatColorClass}
                    />,
                  )
                } else if (chatUnreadCurrentProject > 0) {
                  parts.push(
                    <NotificationBadge
                      key="chat-unread"
                      className={
                        effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''
                      }
                      text={cap99(chatUnreadCurrentProject)}
                      tooltipLabel={`${chatUnreadCurrentProject} unread chats`}
                      colorClass={chatColorClass}
                    />,
                  )
                }

                return parts.length ? <>{parts}</> : null
              }
              return null
            }

            const Btn = (
              <button
                ref={ref as any}
                type="button"
                className={`nav-item ${isActive ? 'nav-item--active' : ''} ${effectiveCollapsed ? 'nav-item--compact' : ''} nav-accent-${item.accent ?? 'brand'}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onActivate(item.view)}
                title={item.label}
                tabIndex={focusIndex === i ? 0 : -1}
                onFocus={() => setFocusIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onActivate(item.view)
                  }
                }}
              >
                <span className="nav-item__icon">{item.icon}</span>
                {!effectiveCollapsed && <span className="nav-item__label">{item.label}</span>}
                {(() => {
                  const content = BtnBadges()
                  return content ? (
                    <span
                      className={classNames(
                        'nav-item__badges',
                        effectiveCollapsed && 'nav-item__badges--compact',
                      )}
                      aria-hidden
                    >
                      {content}
                    </span>
                  ) : null
                })()}
              </button>
            )
            return (
              <li key={item.id} className="nav-li">
                {effectiveCollapsed ? (
                  <Tooltip content={item.label} placement="right">
                    {Btn}
                  </Tooltip>
                ) : (
                  Btn
                )}
              </li>
            )
          })}
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
            .map((p) => renderProjectItem(p))}

          {!effectiveCollapsed &&
            activeGroups.map((g) => {
              const projectById = new Map(activeProjects.map((p) => [p.id, p]))
              const groupProjects = (g.projects || [])
                .map((pid) => projectById.get(pid))
                .filter(Boolean) as ProjectSpec[]
              const isOpen = openGroups[g.id] || false

              const isActiveGroup = activeSelectionType === 'group' && activeGroupId === g.id
              const accentClass = isActiveGroup ? 'nav-accent-brand' : ''

              const groupBadge = getGroupBadgeState(g.id)

              const aggActive = groupBadge.agent_runs.running
              const aggAgentsCompletedUnread = groupBadge.agent_runs.unread
              const aggChatUnread = groupBadge.chat_messages.unread
              const aggThinking = groupBadge.chat_messages.thinking ? 1 : 0
              const aggGitIncoming = groupBadge.git_changes.incoming
              const aggGitUncommitted = groupBadge.git_changes.uncommitted

              const aggShowAgents = isBadgeEnabled('agent_runs') && aggActive > 0
              const aggShowAgentsCompleted =
                isBadgeEnabled('agent_runs') && aggAgentsCompletedUnread > 0
              const aggShowChat =
                isBadgeEnabled('chat_messages') && (aggChatUnread > 0 || aggThinking > 0)

              const aggShowGitIncoming =
                isBadgeEnabled('git_changes') &&
                isGitBadgeSubToggleEnabled('incoming_commits') &&
                aggGitIncoming > 0
              const aggShowGitUncommitted =
                isBadgeEnabled('git_changes') &&
                isGitBadgeSubToggleEnabled('uncommitted_changes') &&
                aggGitUncommitted

              const showAnyBadge =
                aggShowAgents ||
                aggShowAgentsCompleted ||
                aggShowChat ||
                aggShowGitIncoming ||
                aggShowGitUncommitted

              return (
                <li key={g.id} className="nav-li">
                  <div
                    className={classNames(
                      'nav-item',
                      'nav-item--compact',
                      accentClass,
                      isActiveGroup && 'nav-item--active',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenGroups((prev) => ({ ...prev, [g.id]: !isOpen }))}
                      className="nav-item__icon flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 rounded"
                      aria-expanded={isOpen}
                      aria-controls={`group-${g.id}`}
                    >
                      <IconChevron
                        className="w-4 h-4"
                        style={{
                          transform: isOpen ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.15s ease',
                        }}
                      />
                    </button>
                    <button
                      type="button"
                      className="nav-item__label flex-1 text-left font-medium outline-none truncate"
                      onClick={() => handleGroupSelect(g.id)}
                    >
                      {g.title}
                    </button>

                    {showAnyBadge && !isOpen && (
                      <span className="nav-item__badges" aria-hidden>
                        {aggShowAgents && (
                          <NotificationBadge
                            className={''}
                            text={`${aggActive}`}
                            tooltipLabel={`${aggActive} running agents in group`}
                            isInformative
                            colorClass={agentColorClass}
                          />
                        )}
                        {aggShowAgentsCompleted && (
                          <NotificationBadge
                            className={''}
                            text={cap99(aggAgentsCompletedUnread)}
                            tooltipLabel={`${aggAgentsCompletedUnread} completed agent runs in group`}
                            colorClass={agentColorClass}
                          />
                        )}
                        {aggShowChat && aggThinking > 0 ? (
                          <SpinnerWithDot
                            size={16}
                            showDot={aggChatUnread > 0}
                            dotTitle={
                              aggChatUnread > 0
                                ? `${aggChatUnread} unread chats in group`
                                : undefined
                            }
                            dotColorClass={chatColorClass}
                          />
                        ) : aggShowChat && aggChatUnread > 0 ? (
                          <NotificationBadge
                            className={''}
                            text={cap99(aggChatUnread)}
                            tooltipLabel={`${aggChatUnread} unread chats in group`}
                            colorClass={chatColorClass}
                          />
                        ) : null}
                        {aggShowGitIncoming && (
                          <NotificationBadge
                            className={''}
                            text={`${aggGitIncoming}↓`}
                            tooltipLabel={`${aggGitIncoming} incoming commits in group`}
                            colorClass={gitColorClass}
                          />
                        )}
                        {aggShowGitUncommitted && (
                          <NotificationBadge
                            className={''}
                            text={`*`}
                            tooltipLabel={`Uncommitted changes in group`}
                            colorClass={gitColorClass}
                          />
                        )}
                      </span>
                    )}
                  </div>

                  {isOpen && (
                    <div className="pl-3 mt-1 flex flex-col gap-1">
                      <ul
                        id={`group-${g.id}`}
                        className="nav-list"
                        aria-label={`${g.title} projects`}
                      >
                        {groupProjects.map((p) => renderProjectItem(p))}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
        </ul>
      </nav>

      <div className="shrink-0" aria-label="Footer">
        <div className="nav-sep" aria-hidden />
        <ul className="nav-list" role="list" onKeyDown={onKeyDownList}>
          {NAV_ITEMS.filter((n) => n.view === 'Settings').map((item) => {
            const idx = NAV_ITEMS.findIndex((n) => n.view === item.view)
            const isActive = currentView === item.view
            const Btn = (
              <button
                type="button"
                className={`nav-item ${isActive ? 'nav-item--active' : ''} ${effectiveCollapsed ? 'nav-item--compact' : ''} nav-accent-${item.accent ?? 'gray'}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onActivate(item.view)}
                title={item.label}
                tabIndex={focusIndex === idx ? 0 : -1}
                onFocus={() => setFocusIndex(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onActivate(item.view)
                  }
                }}
              >
                <span className="nav-item__icon">{item.icon}</span>
                {!effectiveCollapsed && <span className="nav-item__label">{item.label}</span>}
              </button>
            )
            return (
              <li key={item.id} className="nav-li">
                {effectiveCollapsed ? (
                  <Tooltip content={item.label} placement="right">
                    {Btn}
                  </Tooltip>
                ) : (
                  Btn
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )

  return (
    <div className="flex h-full w-full min-w-0">
      {isMobile ? (
        <>
          {mobileOpen && (
            <>
              <div
                className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
                aria-hidden
              />
              <div className="fixed inset-y-0 left-0 z-30" style={{ width: 260 }}>
                {React.cloneElement(Aside, {
                  className: `${Aside.props.className} drawer-open`,
                  'data-collapsed': 'false',
                })}
              </div>
            </>
          )}
        </>
      ) : (
        Aside
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="md:hidden sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="nav-trigger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <IconMenu />
          </button>
          <div className="text-sm font-semibold">{currentView}</div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{renderedView}</div>
      </main>
    </div>
  )
}
