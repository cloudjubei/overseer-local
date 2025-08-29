import { useEffect } from 'react';
import { dependencyResolver } from '../services/dependencyResolver';
import { useProjectContext } from './ProjectContext';

/**
 * Bootstraps the global dependencyResolver so it:
 * - Initializes once at app start
 * - Tracks the current ProjectSpec from ProjectContext
 * - Rebuilds automatically on tasks index changes (handled in the service)
 */
export function DependencyResolverBootstrap() {
  const { currentProject } = useProjectContext?.() ?? { currentProject: null } as any;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await dependencyResolver.init(currentProject ?? null);
        if (!cancelled) {
          // Ensure project is set (init might have been called with null before context resolved)
          dependencyResolver.setProject(currentProject ?? null);
        }
      } catch (e) {
        // Silently fail; UI components will surface missing refs as chips with error state
        console.error('Failed to initialize dependencyResolver', e);
      }
    })();
    return () => { cancelled = true; };
  }, [currentProject]);

  return null;
}

export default DependencyResolverBootstrap;
