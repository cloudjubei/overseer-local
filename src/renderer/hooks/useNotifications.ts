import { useState, useEffect } from 'react';
import { notificationsService } from '../services/notificationsService';
import type { Notification } from '../../types/notifications';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const updateNotifications = () => {
      const recent = notificationsService.getRecent(); // Default 24 hours, or adjust as needed
      setNotifications(recent);
      setUnreadCount(notificationsService.getUnreadCount());
    };

    updateNotifications();

    const unsubscribe = notificationsService.subscribe(updateNotifications);

    return () => {
      unsubscribe();
    };
  }, []);

  const markAsRead = (id: string) => {
    notificationsService.markAsRead(id);
  };

  const markAllAsRead = () => {
    notificationsService.markAllAsRead();
  };

  const clearAll = () => {
    notificationsService.deleteAll();
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
