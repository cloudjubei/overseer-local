import { useEffect, useState } from 'react';
import { tasksService } from '../services/tasksService';
import type { TasksIndexSnapshot } from '../../types/external';

export function useTasksIndex() {
  const [index, setIndex] = useState<TasksIndexSnapshot | null>(null);

  useEffect(() => {
    const load = async () => {
      const idx = await tasksService.getSnapshot();
      setIndex(idx);
    };
    load();
    const unsubscribe = tasksService.onUpdate(setIndex);
    return unsubscribe;
  }, []);

  return index;
}
