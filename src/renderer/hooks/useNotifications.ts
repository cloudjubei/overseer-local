import { useState, useEffect } from 'react';
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
      setNotifications(await notificationsService.getRecentNotifications(activeProject.id));
      setUnreadCount(await notificationsService.getUnreadNotificationsCount(activeProject.id));
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
      notificationsService.markNotificationAsRead(activeProject.id, id);
    }
  };

  const markAllAsRead = () => {
    if (activeProject){
      notificationsService.markAllNotificationsAsRead(activeProject.id);
    }
  };

  const clearAll = () => {
    if (activeProject){
      notificationsService.deleteAllNotifications(activeProject.id);
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
