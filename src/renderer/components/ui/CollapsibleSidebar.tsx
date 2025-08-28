import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
};

export default function CollapsibleSidebar({
  items,
  activeId,
  onSelect,
  storageKey,
  headerTitle,
  headerSubtitle,
  headerAction,
  emptyMessage,
}: Props) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (!storageKey) return false;
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, collapsed ? '1' : '0');
    } catch {}
  }, [collapsed, storageKey]);

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
      className={`sidebar relative z-30 flex h-full shrink-0 flex-col border-r bg-white dark:bg-neutral-900 dark:border-neutral-800 ${collapsed ? 'collapsed' : ''}`}
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
        <ul className="nav-list" role="list">
          {items.length === 0 && emptyMessage && (
            <li key="empty" className="nav-li">
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 px-2 py-1.5">{emptyMessage}</div>
            </li>
          )}
          {items.map((item, i) => {
            const isActive = activeId === item.id;
            const Btn = (
              <button
                type="button"
                className={`nav-item ${isActive ? 'nav-item--active' : ''} ${collapsed ? 'nav-item--compact' : ''} nav-accent-${item.accent ?? 'gray'}`}
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
              </button>
            );
            return (
              <li key={item.id} className="nav-li">
                {collapsed ? <Tooltip content={item.label} placement="right">{Btn}</Tooltip> : Btn}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
