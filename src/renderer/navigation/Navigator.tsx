import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NavigationView } from '../types';

export type TasksRoute =
  | { name: 'list' }
  | { name: 'details'; taskId: string; highlightFeatureId?: string; highlightTask?: boolean };

export type ModalRoute =
  | { type: 'task-create' }
  | { type: 'task-edit'; taskId: string }
  | { type: 'feature-create'; taskId: string }
  | { type: 'feature-edit'; taskId: string; featureId: string }
  | { type: 'llm-config-add' }
  | { type: 'llm-config-edit'; id: string }
  | { type: 'projects-manage' };

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
  navigateTaskDetails: (taskId: string, highlightFeatureId?: string, highlightTask?: boolean) => void;
};

function viewPrefixToView(prefix: string): NavigationView {
  switch (prefix) {
    case 'files':
    case 'documents': // legacy compatibility: map old Documents route to Files
      return 'Files';
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

const uuidRegex = /[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}/

function parseHash(hashRaw: string): NavigatorState {
  const raw = (hashRaw || '').replace(/^#/, '');

  const [prefixRaw] = raw.split('/');
  const prefix = prefixRaw || 'home';

  const currentView: NavigationView = viewPrefixToView(prefix);

  let tasksRoute: TasksRoute = { name: 'list' };
  let m: RegExpExecArray | null;
  if ((m = /^task\/([0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12})(?:\/highlight-task)?(?:\/highlight-feature\/([0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}))?/.exec(raw))) {
    const taskId = m[1];
    const highlightFeatureId = m[2] || undefined;
    const highlightTask = raw.includes('/highlight-task') ? true : undefined;
    tasksRoute = { name: 'details', taskId, highlightFeatureId, highlightTask };
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
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openModal = useCallback((m: ModalRoute) => {
    setModal({ modal: m });
  }, []);

  const closeModal = useCallback(() => {
    setModal({ modal: null });
  }, []);

  const navigateView = useCallback((v: NavigationView) => {
    switch (v) {
      case 'Home':
        window.location.hash = '#home';
        break;
      case 'Files':
        window.location.hash = '#files';
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

  const navigateTaskDetails = useCallback((taskId: string, highlightFeatureId?: string, highlightTask: boolean = false) => {
    let hash = `#task/${taskId}`;
    if (highlightFeatureId) {
      hash += `/highlight-feature/${highlightFeatureId}`;
    } else if (highlightTask) {
      hash += `/highlight-task`;
    }
    window.location.hash = hash;
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
