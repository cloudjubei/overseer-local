import React, { useEffect, useState, useMemo } from 'react';
import TasksView from './TasksView';
import DocumentsView from './DocumentsView';
import SettingsView from './SettingsView';
import ChatView from './ChatView';
import { useNavigator } from '../navigation/Navigator';

export type SidebarProps = {};

const NavItem = ({ label, isActive, onClick, icon, collapsed }: { label: string; isActive?: boolean; onClick: () => void; icon?: React.ReactNode; collapsed?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
        : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
    }`}
    title={label}
  >
    {icon ? <span className="text-base" aria-hidden>{icon}</span> : null}
    {!collapsed && <span className="truncate">{label}</span>}
  </button>
);

export default function SidebarView({}: SidebarProps) {
  const { currentView, navigateView } = useNavigator();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar-collapsed') === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  const renderedView = useMemo(() => {
    if (currentView === 'Documents') return <DocumentsView />;
    if (currentView === 'Settings') return <SettingsView />;
    if (currentView === 'Chat') return <ChatView />;
    return <TasksView />;
  }, [currentView]);

  return (
    <div className="flex h-full w-full">
      <aside
        className={`flex h-full shrink-0 flex-col border-r border-neutral-200 bg-white p-3 transition-all duration-200 dark:border-neutral-800 dark:bg-neutral-900 ${collapsed ? 'w-14' : 'w-56'}`}
      >
        <div className={`mb-3 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-1`}>
          {!collapsed && (
            <div className="px-1">
              <div className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Project</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">Navigation</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '\u00bb' : '\u00ab'}
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-auto">
          <NavItem label="Home" isActive={currentView === 'Home'} onClick={() => navigateView('Home')} icon={<span>\ud83c\udfe0</span>} collapsed={collapsed} />
          <NavItem label="Docs" isActive={currentView === 'Documents'} onClick={() => navigateView('Documents')} icon={<span>\ud83d\udcda</span>} collapsed={collapsed} />
          <NavItem label="Chat" isActive={currentView === 'Chat'} onClick={() => navigateView('Chat')} icon={<span>\ud83d\udcac</span>} collapsed={collapsed} />
          <div className="mt-auto border-t border-neutral-200 pt-2 dark:border-neutral-800" />
          <NavItem label="Settings" isActive={currentView === 'Settings'} onClick={() => navigateView('Settings')} icon={<span>\u2699\ufe0f</span>} collapsed={collapsed} />
        </nav>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {renderedView}
        </div>
      </main>
    </div>
  );
}
