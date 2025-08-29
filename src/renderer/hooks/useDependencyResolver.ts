import { useEffect, useState } from 'react';
import { taskService } from '../services/taskService';
import type { DependencyResolverIndex } from 'src/types/tasks';
import type { ProjectSpec } from 'src/types/tasks';

export function useDependencyResolver(project?: ProjectSpec | null) {
  const [idx, setIdx] = useState<DependencyResolverIndex | null>(null);

  useEffect(() => {
    let unsub: undefined | (() => void);
    const run = async () => {
      const _idx = await taskService.initDependencies(project ?? null);
      setIdx(_idx);
      unsub = taskService.onDependenciesUpdate(setIdx);
      if (project) taskService.setProject(project);
    };
    run();
    return () => {
      if (unsub) unsub();
    };
  }, [project?.id]);

  return idx;
}
