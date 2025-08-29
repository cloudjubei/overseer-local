import { useEffect } from 'react';
import { taskService } from '../services/taskService';
import { useProjectContext } from './ProjectContext';

/**
 * Bootstraps the global dependencyResolver so it:
 * - Initializes once at app start
 * - Tracks the current ProjectSpec from ProjectContext
 * - Rebuilds automatically on tasks index changes (handled in the service)
 */
export function DependencyResolverBootstrap() {
  const { activeProjectId, activeProject } = useProjectContext?.() ?? { project: null } as any;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await taskService.initDependencies(activeProject ?? null);
        if (!cancelled) {
          // Ensure project is set (init might have been called with null before context resolved)
          taskService.setProject(activeProject ?? null);
        }
      } catch (e) {
        // Silently fail; UI components will surface missing refs as chips with error state
        console.error('Failed to initialize dependencyResolver', e);
      }
    })();
    return () => { cancelled = true; };
  }, [activeProjectId]);

  return null;
}

export default DependencyResolverBootstrap;
