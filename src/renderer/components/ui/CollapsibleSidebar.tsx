import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Tooltip from './Tooltip';

export type CollapsibleSidebarItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  accent?: string;
  badge?: number;
  action?: React.ReactNode;
};

type Props = {
  items: CollapsibleSidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
  storageKey?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerAction?: React.ReactNode;
  emptyMessage?: string;
  children?: React.ReactNode;
  sidebarClassName?: string;
  navContent?: React.ReactNode;
};

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

export default function CollapsibleSidebar(props: Props) {
  const { items, activeId, onSelect, storageKey, headerTitle, headerSubtitle, headerAction, emptyMessage, children, sidebarClassName, navContent } = props;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (!storageKey) return false;
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const SidebarContent = ({ collapsed, setCollapsed, className = '' }: { collapsed: boolean; setCollapsed: (v: boolean) => void; className?: string }) => {
    useEffect(() => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, collapsed ? '1' : '0');
      } catch {}
    }, [collapsed]);

    const activeIndex = useMemo(() => {
      const idx = items.findIndex((n) => n.id === activeId);
      return idx >= 0 ? idx : 0;
    }, [items, activeId]);

    const [focusIndex, setFocusIndex] = useState<number>(activeIndex);

    useEffect(() => setFocusIndex(activeIndex), [activeIndex]);

    const onKeyDownList = useCallback((e: React.KeyboardEvent) => {
      const max = items.length - 1;
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
    }, [items.length]);

    return (
      <aside
        className={`sidebar relative z-30 flex h-full shrink-0 flex-col border-r bg-white dark:bg-neutral-900 dark:border-neutral-800 ${collapsed ? 'collapsed' : ''} ${className}`}
        aria-label="Navigation"
        data-collapsed={collapsed ? 'true' : 'false'}
      >
        <div className={`mb-2 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-2 pt-3`}>
          {!collapsed && (
            <div className="px-1">
              <div className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">{headerTitle ?? 'Sections'}</div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{headerSubtitle ?? ''}</div>
            </div>
          )}
          <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
            {!collapsed && headerAction}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="nav-toggle"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expand sidebar (⌘/Ctrl+B)' : 'Collapse sidebar (⌘/Ctrl+B)'}
            >
              <span aria-hidden>{collapsed ? '»' : '«'}</span>
            </button>
          </div>
        </div>

        <nav className="nav flex-1 min-h-0 overflow-y-auto" onKeyDown={onKeyDownList}>
          {navContent || (
            <ul className="nav-list" role="list">
              {items.length === 0 && emptyMessage && (
                <li key="empty" className="nav-li">
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 px-2 py-1.5">{emptyMessage}</div>
                </li>
              )}
              {items.map((item, i) => {
                const isActive = activeId === item.id;
                return (
                  <li key={item.id} className="nav-li">
                    <div
                      className={`nav-item ${isActive ? 'nav-item--active' : ''} ${collapsed ? 'nav-item--compact' : ''} nav-accent-${item.accent ?? 'gray'}`}
                      role="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => onSelect(item.id)}
                      title={item.label}
                      tabIndex={focusIndex === i ? 0 : -1}
                      onFocus={() => setFocusIndex(i)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect(item.id);
                        }
                      }}
                    >
                      {item.icon && <span className="nav-item__icon">{item.icon}</span>}
                      {!collapsed && <span className="nav-item__label">{item.label}</span>}
                      {item.badge && item.badge > 0 && (
                        <span className="nav-item__badge">{item.badge}</span>
                      )}
                      {!collapsed && item.action && <span className="nav-item__action ml-auto">{item.action}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>
    );
  };

  if (!children) {
    return <SidebarContent collapsed={collapsed} setCollapsed={setCollapsed} className={sidebarClassName} />;
  }

  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
        setTimeout(() => mobileTriggerRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  if (isMobile) {
    return (
      <div className="flex h-full w-full min-w-0 flex-col">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="nav-trigger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            ☰
          </button>
          <div className="text-sm font-semibold">{headerTitle ?? 'Sections'}</div>
        </div>
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <div className="fixed inset-y-0 left-0 z-30" style={{ width: 260 }}>
              <SidebarContent collapsed={false} setCollapsed={() => setMobileOpen(false)} className={sidebarClassName} />
            </div>
          </>
        )}
        <div className="flex-1 min-w-0 min-h-0 overflow-auto p-4">
          {children}
        </div>
      </div>
    );
  } else {
    return (
      <div className="flex h-full w-full min-w-0">
        <SidebarContent collapsed={collapsed} setCollapsed={setCollapsed} className={sidebarClassName} />
        <main className="flex-1 min-w-0 min-h-0 overflow-auto p-4">
          {children}
        </main>
      </div>
    );
  }
}
