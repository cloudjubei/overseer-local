import { useState, useEffect, useCallback } from 'react';
import { notificationsService } from '../services/notificationsService';
import type { Notification } from '../../types/notifications';
import { useProjectContext } from '../projects/ProjectContext';

export function useNotifications() {
  const {
    activeProject
  } = useProjectContext()
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const updateCurrentProjectNotifications = useCallback(async () => {
    if (activeProject){
      setNotifications(await notificationsService.getRecentNotifications(activeProject.id));
      setUnreadCount(await notificationsService.getUnreadNotificationsCount(activeProject.id));
    }
  }, [activeProject?.id]);

  // Subscribe to notifications changes; re-subscribe when active project changes
  useEffect(() => {
    // Initial fetch for current project
    updateCurrentProjectNotifications();

    const unsubscribe = notificationsService.subscribe((payload?: any) => {
      // Optionally ignore updates for other projects
      if (activeProject && payload?.projectId && payload.projectId !== activeProject.id) return;
      updateCurrentProjectNotifications();
    });

    return () => {
      unsubscribe();
    };
  }, [activeProject?.id, updateCurrentProjectNotifications]);

  // Also refresh when activeProject changes (covers cases without a broadcast)
  useEffect(() => {
    updateCurrentProjectNotifications();
  }, [activeProject?.id, updateCurrentProjectNotifications]);

  // When a notification is opened/clicked, navigate to the Agents view and focus the run
  useEffect(() => {
    const off = notificationsService.onOpenNotification?.((metadata) => {
      try {
        const runId = (metadata as any)?.runId || (metadata as any)?.agentRunId || (metadata as any)?.id;
        const destination = (metadata as any)?.destination || (metadata as any)?.screen;
        // If this is an agent run notification, set the hash so AgentsView can scroll/highlight
        if (runId) {
          // Ensure we navigate to Agents screen; assume hash-based navigation
          // Preserve any other state but set the agents run target
          window.location.hash = `agents/run/${runId}`;
        } else if (destination === 'agents') {
          window.location.hash = 'agents';
        }
      } catch (_) {
        // no-op
      }
    }) ?? (() => {});
    return () => off();
  }, []);

  const markAsRead = async (id: string) => {
    if (activeProject){
      await notificationsService.markNotificationAsRead(activeProject.id, id);
      await updateCurrentProjectNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (activeProject){
      await notificationsService.markAllNotificationsAsRead(activeProject.id);
      await updateCurrentProjectNotifications();
    }
  };

  const clearAll = async () => {
    if (activeProject){
      await notificationsService.deleteAllNotifications(activeProject.id);
      await updateCurrentProjectNotifications();
    }
  };

  const enableNotifications = async () => {
    try {
      const result = await notificationsService.sendOs({
        title: 'Notifications Enabled',
        message: 'You will now receive desktop notifications for important events.',
        soundsEnabled: false,
        displayDuration: 5,
      })
      return (result as any).ok ?? (result as any).success ?? false
    } catch (_) {
      return false
    }
  }

  return {
    enableNotifications,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
