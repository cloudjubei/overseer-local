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

function viewPrefixToView(prefix: string): NavigationView {
  switch (prefix) {
    case 'documents':
      return 'Documents';
    case 'chat':
      return 'Chat';
    case 'settings':
      return 'Settings';
    case 'home':
    default:
      return 'Home';
  }
}

function viewToPrefix(v: NavigationView): string {
  switch (v) {
    case 'Documents':
      return 'documents';
    case 'Chat':
      return 'chat';
    case 'Settings':
      return 'settings';
    case 'Home':
    default:
      return 'home';
  }
}

function parseModal(fragment: string): ModalRoute | null {
  let m: RegExpExecArray | null;
  if (fragment === 'task-create') return { type: 'task-create' };
  if ((m = /^task-edit\/(\d+)$/.exec(fragment))) return { type: 'task-edit', taskId: parseInt(m[1], 10) };
  if ((m = /^feature-create\/(\d+)$/.exec(fragment))) return { type: 'feature-create', taskId: parseInt(m[1], 10) };
  if ((m = /^feature-edit\/(\d+)\/(.+)$/.exec(fragment))) return { type: 'feature-edit', taskId: parseInt(m[1], 10), featureId: m[2] };
  return null;
}

function parseHash(hashRaw: string): NavigatorState {
  const raw = (hashRaw || '').replace(/^#/, '');

  const [prefixRaw, ...restParts] = raw.split('/');
  const prefix = prefixRaw || 'home';
  const rest = restParts.join('/');

  // Determine current view from the first segment
  const currentView: NavigationView = viewPrefixToView(prefix);

  // Modal: prefer parsing from the secondary segment if present; otherwise allow legacy top-level
  let modal: ModalRoute | null = null;
  if (rest) {
    modal = parseModal(rest);
  }
  if (!modal) {
    modal = parseModal(raw);
  }

  // Tasks route (details) recognized on legacy top-level form
  let tasksRoute: TasksRoute = { name: 'list' };
  let m: RegExpExecArray | null;
  if ((m = /^task\/(\d+)$/.exec(raw))) {
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
    // Build a composite hash so the modal opens over the current view instead of resetting to Home
    const basePrefix = viewToPrefix(currentParsed.currentView);
    const base = `#${basePrefix}`;
    switch (m.type) {
      case 'task-create':
        window.location.hash = `${base}/task-create`;
        break;
      case 'task-edit':
        window.location.hash = `${base}/task-edit/${m.taskId}`;
        break;
      case 'feature-create':
        window.location.hash = `${base}/feature-create/${m.taskId}`;
        break;
      case 'feature-edit':
        window.location.hash = `${base}/feature-edit/${m.taskId}/${m.featureId}`;
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
