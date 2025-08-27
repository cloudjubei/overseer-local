import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TasksView from './TasksView';
import DocumentsView from './DocumentsView';
import SettingsView from './SettingsView';
import ChatView from './ChatView';
import NotificationsView from './NotificationsView';
import { useNavigator } from '../navigation/Navigator';
import Tooltip from '../components/ui/Tooltip';
import { useNotifications } from '../hooks/useNotifications';
import { useShortcuts } from '../hooks/useShortcuts';

export type SidebarProps = {};

type NavDef = {
  id: string;
  label: string;
  view: 'Home' | 'Documents' | 'Chat' | 'Settings' | 'Notifications';
  icon: React.ReactNode;
  accent?: 'brand' | 'purple' | 'teal' | 'gray';
};

const NAV_ITEMS: NavDef[] = [
  { id: 'home', label: 'Home', view: 'Home', icon: <span aria-hidden>🏠</span>, accent: 'brand' },
  { id: 'docs', label: 'Docs', view: 'Documents', icon: <span aria-hidden>📚</span>, accent: 'purple' },
  { id: 'chat', label: 'Chat', view: 'Chat', icon: <span aria-hidden>💬</span>, accent: 'teal' },
  { id: 'notifications', label: 'Notifications', view: 'Notifications', icon: <span aria-hidden>🔔</span>, accent: 'teal' },
  { id: 'settings', label: 'Settings', view: 'Settings', icon: <span aria-hidden>⚙️</span>, accent: 'gray' },
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

export default function SidebarView({}: SidebarProps) {
  const { currentView, navigateView } = useNavigator();
  const { unreadCount } = useNotifications();
  const { register } = useShortcuts();

  // Persistent collapsed state (desktop)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar-collapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0'); } catch {}
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

  // Register shortcut for notifications (Cmd/Ctrl + Shift + N)
  useEffect(() => {
    const unregister = register({
      id: 'open-notifications',
      keys: (e) => (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'n' || e.key === 'N'),
      handler: () => { navigateView('Notifications'); },
      description: 'Open Notifications',
      scope: 'global',
    });
    return unregister;
  }, [register, navigateView]);

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
    if (currentView === 'Documents') return <div key="Documents" className="flex flex-col flex-1 min-h-0 view-transition"><DocumentsView /></div>;
    if (currentView === 'Settings') return <div key="Settings" className="flex flex-col flex-1 min-h-0 view-transition"><SettingsView /></div>;
    if (currentView === 'Chat') return <div key="Chat" className="flex flex-col flex-1 min-h-0 view-transition"><ChatView /></div>;
    if (currentView === 'Notifications') return <div key="Notifications" className="flex flex-col flex-1 min-h-0 view-transition"><NotificationsView /></div>;
    return <div key="Home" className="flex flex-col flex-1 min-h-0 view-transition"><TasksView /></div>;
  }, [currentView]);

  // Sidebar element (shared for desktop and mobile drawer)
  const Aside = (
    <aside
      className={`sidebar relative z-30 flex h-full shrink-0 flex-col border-r bg-white dark:bg-neutral-900 dark:border-neutral-800 ${collapsed ? 'collapsed' : ''}`}
      aria-label="Primary navigation"
      data-collapsed={collapsed ? 'true' : 'false'}
      style={{}}
    >
      <div className={`mb-2 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-2 pt-3`}>
        {!collapsed && (
          <div className="px-1">
            <div className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Workspace</div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Navigation</div>
          </div>
        )}
        <button
          type="button"
          onClick={() => (isMobile ? setMobileOpen(false) : setCollapsed((v) => !v))}
          className="nav-toggle"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar (⌘/Ctrl+B)' : 'Collapse sidebar (⌘/Ctrl+B)'}
        >
          <span aria-hidden>{collapsed ? '»' : '«'}</span>
        </button>
      </div>

      <nav className="nav" onKeyDown={onKeyDownList}>
        <ul className="nav-list" role="list">
          {NAV_ITEMS.filter((n) => n.view !== 'Settings').map((item, i) => {
            const isActive = currentView === item.view;
            const ref = i === 0 ? firstItemRef : undefined;
            const showBadge = item.view === 'Notifications' && unreadCount > 0;
            const Btn = (
              <button
                ref={ref as any}
                type="button"
                className={`nav-item ${isActive ? 'nav-item--active' : ''} ${collapsed ? 'nav-item--compact' : ''} nav-accent-${item.accent ?? 'brand'}`}
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
                {!collapsed && <span className="nav-item__label">{item.label}</span>}
                {showBadge && (
                  <span className="nav-item__badge">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
            return (
              <li key={item.id} className="nav-li">
                {collapsed ? (
                  <Tooltip content={item.label} placement="right">{Btn}</Tooltip>
                ) : Btn}
              </li>
            );
          })}
        </ul>

        <div className="nav-sep" aria-hidden />

        <ul className="nav-list" role="list">
          {/* Keep Settings at bottom */}
          {NAV_ITEMS.filter((n) => n.view === 'Settings').map((item) => {
            const idx = NAV_ITEMS.findIndex((n) => n.view === 'Settings');
            const isActive = currentView === item.view;
            const Btn = (
              <button
                type="button"
                className={`nav-item ${isActive ? 'nav-item--active' : ''} ${collapsed ? 'nav-item--compact' : ''} nav-accent-${item.accent ?? 'gray'}`}
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
                {!collapsed && <span className="nav-item__label">{item.label}</span>}
              </button>
            );
            return (
              <li key={item.id} className="nav-li">
                {collapsed ? (
                  <Tooltip content={item.label} placement="right">{Btn}</Tooltip>
                ) : Btn}
              </li>
            );
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
