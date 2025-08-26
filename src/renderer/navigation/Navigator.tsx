import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationView } from '../types';

export type TasksRoute =
  | { name: 'list' }
  | { name: 'details'; taskId: number };

export type ModalRoute =
  | { type: 'task-create' }
  | { type: 'task-edit'; taskId: number }
  | { type: 'feature-create'; taskId: number }
  | { type: 'feature-edit'; taskId: number; featureId: string };

export type NavigatorState = {
  currentView: NavigationView;
  tasksRoute: TasksRoute;
  modal: ModalRoute | null;
};

export type NavigatorApi = NavigatorState & {
  openModal: (m: ModalRoute) => void;
  closeModal: () => void;
  navigateView: (v: NavigationView) => void;
  navigateTaskDetails: (taskId: number) => void;
};

function parseHash(hashRaw: string): NavigatorState {
  const hash = (hashRaw || '').replace(/^#/, '');

  // Screen-level views
  let currentView: NavigationView = 'Home';
  if (hash.startsWith('documents')) currentView = 'Documents';
  else if (hash.startsWith('chat')) currentView = 'Chat';
  else if (hash.startsWith('settings')) currentView = 'Settings';
  else currentView = 'Home';

  // Modal routes
  let modal: ModalRoute | null = null;
  let m: RegExpExecArray | null;
  if (hash === 'task-create') {
    modal = { type: 'task-create' };
  } else if ((m = /^task-edit\/(\d+)$/.exec(hash))) {
    modal = { type: 'task-edit', taskId: parseInt(m[1], 10) };
  } else if ((m = /^feature-create\/(\d+)$/.exec(hash))) {
    modal = { type: 'feature-create', taskId: parseInt(m[1], 10) };
  } else if ((m = /^feature-edit\/(\d+)\/(.+)$/.exec(hash))) {
    modal = { type: 'feature-edit', taskId: parseInt(m[1], 10), featureId: m[2] };
  }

  // Tasks route (for Home screen)
  let tasksRoute: TasksRoute = { name: 'list' };
  if ((m = /^task\/(\d+)$/.exec(hash))) {
    tasksRoute = { name: 'details', taskId: parseInt(m[1], 10) };
  }

  return { currentView, tasksRoute, modal };
}

const NavigatorContext = createContext<NavigatorApi | null>(null);

export function NavigatorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NavigatorState>(() => parseHash(window.location.hash));
  const lastNonModalHashRef = useRef<string>('');

  useEffect(() => {
    const onHash = () => {
      const next = parseHash(window.location.hash);
      // Track last non-modal hash to restore on close
      if (!next.modal) {
        lastNonModalHashRef.current = window.location.hash || '#home';
      }
      setState(next);
    };
    window.addEventListener('hashchange', onHash);
    // Initialize
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openModal = useCallback((m: ModalRoute) => {
    // Remember the current non-modal hash so we can return
    const currentParsed = parseHash(window.location.hash);
    if (!currentParsed.modal) {
      lastNonModalHashRef.current = window.location.hash || '#home';
    }
    switch (m.type) {
      case 'task-create':
        window.location.hash = '#task-create';
        break;
      case 'task-edit':
        window.location.hash = `#task-edit/${m.taskId}`;
        break;
      case 'feature-create':
        window.location.hash = `#feature-create/${m.taskId}`;
        break;
      case 'feature-edit':
        window.location.hash = `#feature-edit/${m.taskId}/${m.featureId}`;
        break;
    }
  }, []);

  const closeModal = useCallback(() => {
    const fallback = '#home';
    const prev = lastNonModalHashRef.current || fallback;
    window.location.hash = prev;
  }, []);

  const navigateView = useCallback((v: NavigationView) => {
    switch (v) {
      case 'Home':
        window.location.hash = '#home';
        break;
      case 'Documents':
        window.location.hash = '#documents';
        break;
      case 'Chat':
        window.location.hash = '#chat';
        break;
      case 'Settings':
        window.location.hash = '#settings';
        break;
    }
  }, []);

  const navigateTaskDetails = useCallback((taskId: number) => {
    window.location.hash = `#task/${taskId}`;
  }, []);

  const value = useMemo<NavigatorApi>(() => ({
    ...state,
    openModal,
    closeModal,
    navigateView,
    navigateTaskDetails,
  }), [state, openModal, closeModal, navigateView, navigateTaskDetails]);

  return <NavigatorContext.Provider value={value}>{children}</NavigatorContext.Provider>;
}

export function useNavigator(): NavigatorApi {
  const ctx = useContext(NavigatorContext);
  if (!ctx) throw new Error('useNavigator must be used within NavigatorProvider');
  return ctx;
}
