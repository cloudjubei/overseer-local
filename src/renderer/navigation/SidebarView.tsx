import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TasksView from '../screens/TasksView';
import FilesView from '../screens/FilesView';
import SettingsView from '../screens/SettingsView';
import ChatView from '../screens/ChatView';
import NotificationsView from '../screens/NotificationsView';
import AgentsView from '../screens/AgentsView';
import AllAgentsView from '../screens/AllAgentsView';
import { useNavigator } from './Navigator';
import Tooltip from '../components/ui/Tooltip';
import { useNotifications } from '../hooks/useNotifications';
// import { useShortcuts } from '../hooks/useShortcuts';
import { MAIN_PROJECT, useProjectContext } from '../projects/ProjectContext';
import type { NavigationView } from '../types';
import { useAppSettings } from '../hooks/useAppSettings';

export type SidebarProps = {};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ')
}

type NavDef = {
  id: string;
  label: string;
  view: NavigationView;
  icon: React.ReactNode;
  accent?: 'brand' | 'purple' | 'teal' | 'gray';
};

const NAV_ITEMS: NavDef[] = [
  { id: 'home', label: 'Home', view: 'Home', icon: <span aria-hidden>🏠</span>, accent: 'brand' },
  { id: 'files', label: 'Files', view: 'Files', icon: <span aria-hidden>📚</span>, accent: 'purple' },
  { id: 'chat', label: 'Chat', view: 'Chat', icon: <span aria-hidden>💬</span>, accent: 'teal' },
  { id: 'agents', label: 'Agents', view: 'Agents', icon: <span aria-hidden>🤖</span>, accent: 'teal' },
  { id: 'notifications', label: 'Notifications', view: 'Notifications', icon: <span aria-hidden>🔔</span>, accent: 'teal' },
  { id: 'settings', label: 'Settings', view: 'Settings', icon: <span aria-hidden>⚙️</span>, accent: 'gray' },
  { id: 'all-agents', label: 'All Agents', view: 'AllAgents', icon: <span aria-hidden>🗂️</span>, accent: 'teal' },
];

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() => typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    if (m.addEventListener) m.addEventListener('change', onChange);
    else m.addListener(onChange);
    setMatches(m.matches);
    return () => {
      if (m.removeEventListener) m.removeEventListener('change', onChange);
      else m.removeListener(onChange);
    };
  }, [query]);
  return matches;
}

function useAccentClass(seed: string, isMain: boolean): string {
  if (isMain) { return 'nav-item nav-accent-gray' }
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

export default function SidebarView({}: SidebarProps) {
  const { currentView, navigateView, openModal } = useNavigator();
  const { unreadCount } = useNotifications();
  // const { register } = useShortcuts();
  const {
    activeProjectId,
    projects,
    setActiveProjectId,
  } = useProjectContext()
  const { isAppSettingsLoaded, appSettings, updateAppSettings } = useAppSettings()

  const [collapsed, setCollapsed] = useState<boolean>(appSettings.userPreferences.sidebarCollapsed);

  useEffect(() => {
    if (isAppSettingsLoaded){
      setCollapsed(appSettings.userPreferences.sidebarCollapsed)
    }
  }, [isAppSettingsLoaded]);
  useEffect(() => {
    updateAppSettings({ userPreferences: { ...appSettings.userPreferences, sidebarCollapsed: collapsed }})
  }, [collapsed]);

  // Responsive: on small screens, render as overlay drawer
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (mobileOpen) {
      // Focus the first navigable item when opening
      setTimeout(() => firstItemRef.current?.focus(), 0);
    }
  }, [mobileOpen]);

  // Keyboard shortcut to toggle collapse on desktop (Cmd/Ctrl+B)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (isMobile) setMobileOpen((v) => !v);
        else setCollapsed((v) => !v);
      }
      if (isMobile && e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
        // restore focus to trigger
        setTimeout(() => mobileTriggerRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, mobileOpen]);

  // useEffect(() => {
  //   const unregister = register({
  //     id: 'open-notifications',
  //     keys: (e) => (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'n' || e.key === 'N'),
  //     handler: () => { navigateView('Notifications'); },
  //     description: 'Open Notifications',
  //     scope: 'global',
  //   });
  //   return unregister;
  // }, [register, navigateView]);

  // Roving tabindex for nav items
  const activeIndex = useMemo(() => {
    const idx = NAV_ITEMS.findIndex((n) => n.view === currentView);
    return idx >= 0 ? idx : 0;
  }, [currentView]);
  const [focusIndex, setFocusIndex] = useState<number>(activeIndex);
  useEffect(() => setFocusIndex(activeIndex), [activeIndex]);

  const onKeyDownList = useCallback((e: React.KeyboardEvent) => {
    const max = NAV_ITEMS.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex((i) => (i >= max ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex((i) => (i <= 0 ? max : i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusIndex(max);
    }
  }, []);

  const onActivate = useCallback((view: NavDef['view']) => {
    navigateView(view);
    if (isMobile) {
      setMobileOpen(false);
      setTimeout(() => mobileTriggerRef.current?.focus(), 0);
    }
  }, [navigateView, isMobile]);

  const renderedView = useMemo(() => {
    if (currentView === 'Files') return <div key="Files" className="flex flex-col flex-1 min-h-0 view-transition"><FilesView /></div>;
    if (currentView === 'Settings') return <div key="Settings" className="flex flex-col flex-1 min-h-0 view-transition"><SettingsView /></div>;
    if (currentView === 'AllAgents') return <div key="AllAgents" className="flex flex-col flex-1 min-h-0 view-transition"><AllAgentsView /></div>;
    if (currentView === 'Chat') return <div key="Chat" className="flex flex-col flex-1 min-h-0 view-transition"><ChatView /></div>;
    if (currentView === 'Notifications') return <div key="Notifications" className="flex flex-col flex-1 min-h-0 view-transition"><NotificationsView /></div>;
    if (currentView === 'Agents') return <div key="Agents" className="flex flex-col flex-1 min-h-0 view-transition"><AgentsView /></div>;
    return <div key="Home" className="flex flex-col flex-1 min-h-0 view-transition"><TasksView /></div>;
  }, [currentView]);

  const effectiveCollapsed = isMobile ? false : collapsed;

  // Sidebar element (shared for desktop and mobile drawer)
  const Aside = (
    <aside
      className={`sidebar relative z-30 flex h-full shrink-0 flex-col border-r bg-white dark:bg-neutral-900 dark:border-neutral-800 ${effectiveCollapsed ? 'collapsed' : ''}`}
      aria-label="Primary navigation"
      data-collapsed={effectiveCollapsed ? 'true' : 'false'}
      style={{}}
    >
      <div className={`mb-2 flex items-center ${effectiveCollapsed ? 'justify-center' : 'justify-between'} px-2 pt-3`}>
        {!effectiveCollapsed && (
          <div className="px-1">
            <div className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Workspace</div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Navigation</div>
          </div>
        )}
        <button
          type="button"
          onClick={() => (isMobile ? setMobileOpen(false) : setCollapsed((v) => !v))}
          className="nav-toggle"
          aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!effectiveCollapsed}
          title={effectiveCollapsed ? 'Expand sidebar (⌘/Ctrl+B)' : 'Collapse sidebar (⌘/Ctrl+B)'}
        >
          <span aria-hidden>{effectiveCollapsed ? '»' : '«'}</span>
        </button>
      </div>

      <nav className="nav" onKeyDown={onKeyDownList}>
        <ul className="nav-list" role="list">
          {NAV_ITEMS.filter((n) => n.view !== 'Settings' && n.view !== 'AllAgents').map((item, i) => {
            const isActive = currentView === item.view;
            const ref = i === 0 ? firstItemRef : undefined;
            const showBadge = item.view === 'Notifications' && unreadCount > 0;
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
                    e.preventDefault();
                    onActivate(item.view);
                  }
                }}
              >
                <span className="nav-item__icon">{item.icon}</span>
                {!effectiveCollapsed && <span className="nav-item__label">{item.label}</span>}
                {showBadge && (
                  <span className="nav-item__badge">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
            return (
              <li key={item.id} className="nav-li">
                {effectiveCollapsed ? (
                  <Tooltip content={item.label} placement="right">{Btn}</Tooltip>
                ) : Btn}
              </li>
            );
          })}
        </ul>

        <div className="nav-sep" aria-hidden />

        <ul className="nav-list" role="list">
          {NAV_ITEMS.filter((n) => n.view === 'Settings' || n.view === 'AllAgents').map((item) => {
            const idx = NAV_ITEMS.findIndex((n) => n.view === item.view);
            const isActive = currentView === item.view;
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
                    e.preventDefault();
                    onActivate(item.view);
                  }
                }}
              >
                <span className="nav-item__icon">{item.icon}</span>
                {!effectiveCollapsed && <span className="nav-item__label">{item.label}</span>}
              </button>
            );
            return (
              <li key={item.id} className="nav-li">
                {effectiveCollapsed ? (
                  <Tooltip content={item.label} placement="right">{Btn}</Tooltip>
                ) : Btn}
              </li>
            );
          })}
        </ul>

        <div className="nav-sep" />
        {/* Projects section */}
        {!effectiveCollapsed && (
          <div className="px-3" aria-hidden>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>Projects</span>
              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span>{projects.length}</span>
                <button className="btn-secondary" style={{ padding: '0 8px', height: 24, fontSize: 12 }} onClick={() => openModal({ type: 'projects-manage' })}>Manage</button>
              </div>
            </div>
          </div>
        )}
        <ul className="nav-list" aria-label="Projects">
          {projects.length == 0 && (
            <li className="nav-li">
              <div className={classNames('nav-item', effectiveCollapsed && 'nav-item--compact')} role="status">
                <span className="nav-item__icon" aria-hidden>⚠️</span>
                {!effectiveCollapsed && <span className="nav-item__label">Failed to load</span>}
              </div>
            </li>
          )}
          {projects.map((p) => {
            const isMain = p.id === MAIN_PROJECT
            const active = activeProjectId === p.id
            const accent = useAccentClass(p.id, isMain)
            return (
              <li className="nav-li" key={p.id}>
                <div className="flex items-center">
                  <button
                    className={classNames('nav-item flex-1', accent, active && 'nav-item--active', effectiveCollapsed && 'nav-item--compact')}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setActiveProjectId(p.id)}
                    title={p.title}
                  >
                    {isMain && <span className="nav-item__icon" aria-hidden>🗂️</span>}
                    {!isMain && <span className="nav-item__icon" aria-hidden>📁</span>}
                    {!effectiveCollapsed && <span className="nav-item__label">{p.title}</span>}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>

      </nav>
    </aside>
  );

  return (
    <div className="flex h-full w-full min-w-0">
      {/* Desktop sidebar or mobile drawer */}
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
                {/* Force expanded UI for drawer, but keep collapsed state persisted */}
                {React.cloneElement(Aside, { className: `${(Aside as any).props.className} drawer-open`, 'data-collapsed': 'false' })}
              </div>
            </>
          )}
        </>
      ) : (
        Aside
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="nav-trigger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            ☰
          </button>
          <div className="text-sm font-semibold">{currentView}</div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {renderedView}
        </div>
      </main>
    </div>
  );
}
