import React from 'react';
import { NavigationView } from '../types';

export type SidebarProps = {
  currentView: NavigationView;
  setCurrentView: (v: NavigationView) => void;
};

const NavItem = ({ label, isActive, onClick, icon }: { label: string; isActive?: boolean; onClick: () => void; icon?: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
        : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
    }`}
  >
    {icon ? <span className="text-base">{icon}</span> : null}
    <span>{label}</span>
  </button>
);

export default function SidebarView({ currentView, setCurrentView }: SidebarProps) {
  return (
    <aside className="sticky top-0 h-screen w-56 shrink-0 border-r border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 px-2">
        <div className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Project</div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">Navigation</div>
      </div>
      <nav className="flex flex-col gap-1">
        <NavItem
          label="Home"
          isActive={currentView === 'Home'}
          onClick={() => setCurrentView('Home')}
          icon={<span>🏠</span>}
        />
        <NavItem
          label="Docs"
          isActive={currentView === 'Documents'}
          onClick={() => setCurrentView('Documents')}
          icon={<span>📚</span>}
        />
      </nav>
      <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <NavItem
          label="Settings"
          isActive={currentView === 'Settings'}
          onClick={() => setCurrentView('Settings')}
          icon={<span>⚙️</span>}
        />
      </div>
    </aside>
  );
}
