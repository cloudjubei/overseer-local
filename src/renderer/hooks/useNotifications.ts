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

  const updateCurrentProjectNotifications = async () => {
    if (activeProject){
      setNotifications(await notificationsService.getRecentNotifications(activeProject));
      setUnreadCount(await notificationsService.getUnreadNotificationsCount(activeProject));
    }
  }

  useEffect(() => {
    updateCurrentProjectNotifications();

    const unsubscribe = notificationsService.subscribe(updateCurrentProjectNotifications);

    return () => {
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    updateCurrentProjectNotifications();
  }, [activeProject]);

  const markAsRead = (id: string) => {
    if (activeProject){
      notificationsService.markNotificationAsRead(activeProject, id);
    }
  };

  const markAllAsRead = () => {
    if (activeProject){
      notificationsService.markAllNotificationsAsRead(activeProject);
    }
  };

  const clearAll = () => {
    if (activeProject){
      notificationsService.deleteAllNotifications(activeProject);
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
