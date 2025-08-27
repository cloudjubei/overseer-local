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
};
export type ModalState = {
  modal: ModalRoute | null;
};

export type NavigatorApi = NavigatorState & ModalState & {
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
    case 'notifications':
      return 'Notifications';
    case 'home':
    default:
      return 'Home';
  }
}

function parseHash(hashRaw: string): NavigatorState {
  const raw = (hashRaw || '').replace(/^#/, '');

  const [prefixRaw] = raw.split('/');
  const prefix = prefixRaw || 'home';

  // Determine current view from the first segment
  const currentView: NavigationView = viewPrefixToView(prefix);

  // Tasks route (details) recognized on legacy top-level form
  let tasksRoute: TasksRoute = { name: 'list' };
  let m: RegExpExecArray | null;
  if ((m = /^task\/(\d+)$/.exec(raw))) {
    tasksRoute = { name: 'details', taskId: parseInt(m[1], 10) };
  }

  return { currentView, tasksRoute };
}

const NavigatorContext = createContext<NavigatorApi | null>(null);

export function NavigatorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NavigatorState>(() => parseHash(window.location.hash));
  const [modal, setModal] = useState<ModalState>({ modal: null });

  useEffect(() => {
    const onHash = () => {
      const next = parseHash(window.location.hash);
      setState(next);
    };
    window.addEventListener('hashchange', onHash);
    // Initialize
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openModal = useCallback((m: ModalRoute) => {
    setModal({ modal: m })
  }, []);

  const closeModal = useCallback(() => {
    setModal({ modal: null })
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
      case 'Notifications':
        window.location.hash = '#notifications';
        break;
    }
  }, []);

  const navigateTaskDetails = useCallback((taskId: number) => {
    window.location.hash = `#task/${taskId}`;
  }, []);

  const value = useMemo<NavigatorApi>(() => ({
    ...state,
    ...modal,
    openModal,
    closeModal,
    navigateView,
    navigateTaskDetails,
  }), [state, modal, openModal, closeModal, navigateView, navigateTaskDetails]);

  return <NavigatorContext.Provider value={value}>{children}</NavigatorContext.Provider>;
}

export function useNavigator(): NavigatorApi {
  const ctx = useContext(NavigatorContext);
  if (!ctx) throw new Error('useNavigator must be used within NavigatorProvider');
  return ctx;
}
