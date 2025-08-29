import { useEffect, useState } from 'react';
import { taskService } from '../services/taskService';
import type { TasksIndexSnapshot } from '../../types/external';

export function useTasksIndex() {
  const [index, setIndex] = useState<TasksIndexSnapshot | null>(null);

  useEffect(() => {
    const load = async () => {
      const idx = await taskService.getSnapshot();
      setIndex(idx);
    };
    load();
    const unsubscribe = taskService.onUpdate(setIndex);
    return unsubscribe;
  }, []);

  return index;
}
