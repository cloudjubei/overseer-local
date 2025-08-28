import { useEffect, useState } from 'react';
import { dependencyResolver, type DependencyResolverIndex } from '../services/dependencyResolver';
import type { ProjectSpec } from 'src/types/tasks';

export function useDependencyResolver(project?: ProjectSpec | null) {
  const [idx, setIdx] = useState<DependencyResolverIndex | null>(null);

  useEffect(() => {
    let unsub: undefined | (() => void);
    const run = async () => {
      const _idx = await dependencyResolver.init(project ?? null);
      setIdx(_idx);
      unsub = dependencyResolver.onUpdate(setIdx);
      if (project) dependencyResolver.setProject(project);
    };
    run();
    return () => {
      if (unsub) unsub();
    };
  }, [project?.id]);

  return idx;
}
