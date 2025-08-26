/**
 * Notifications service for managing notification data with CRUD operations and persistence
 */

import {
  Notification,
  NotificationCreateInput,
  NotificationUpdateInput,
  NotificationFilter,
  NotificationSort,
  NotificationQuery,
  NotificationStats,
  NotificationType,
  NotificationCategory
} from '../../types/notifications';

class NotificationsService {
  private readonly STORAGE_KEY = 'app_notifications';
  private notifications: Map<string, Notification> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load notifications from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as Notification[];
        this.notifications.clear();
        data.forEach(notification => {
          this.notifications.set(notification.id, notification);
        });
      }
    } catch (error) {
      console.error('Failed to load notifications from storage:', error);
      this.notifications.clear();
    }
  }

  /**
   * Save notifications to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.notifications.values());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save notifications to storage:', error);
    }
  }

  /**
   * Generate a unique ID for a notification
   */
  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Create a new notification
   */
  create(input: NotificationCreateInput): Notification {
    const notification: Notification = {
      id: this.generateId(),
      timestamp: Date.now(),
      type: input.type,
      category: input.category,
      title: input.title,
      message: input.message,
      read: false,
      metadata: input.metadata
    };

    this.notifications.set(notification.id, notification);
    this.saveToStorage();
    this.notifyListeners();

    return notification;
  }

  /**
   * Get a notification by ID
   */
  getById(id: string): Notification | null {
    return this.notifications.get(id) || null;
  }

  /**
   * Update a notification
   */
  update(id: string, updates: NotificationUpdateInput): Notification | null {
    const notification = this.notifications.get(id);
    if (!notification) {
      return null;
    }

    const updatedNotification = {
      ...notification,
      ...updates,
      metadata: updates.metadata ? { ...notification.metadata, ...updates.metadata } : notification.metadata
    };

    this.notifications.set(id, updatedNotification);
    this.saveToStorage();
    this.notifyListeners();

    return updatedNotification;
  }

  /**
   * Delete a notification by ID
   */
  delete(id: string): boolean {
    const existed = this.notifications.has(id);
    if (existed) {
      this.notifications.delete(id);
      this.saveToStorage();
      this.notifyListeners();
    }
    return existed;
  }

  /**
   * Mark a notification as read
   */
  markAsRead(id: string): Notification | null {
    return this.update(id, { read: true });
  }

  /**
   * Mark a notification as unread
   */
  markAsUnread(id: string): Notification | null {
    return this.update(id, { read: false });
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    let hasChanges = false;
    this.notifications.forEach((notification, id) => {
      if (!notification.read) {
        this.notifications.set(id, { ...notification, read: true });
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Delete all notifications
   */
  deleteAll(): void {
    if (this.notifications.size > 0) {
      this.notifications.clear();
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Apply filters to a notification
   */
  private matchesFilter(notification: Notification, filter: NotificationFilter): boolean {
    if (filter.type && notification.type !== filter.type) {
      return false;
    }
    if (filter.category && notification.category !== filter.category) {
      return false;
    }
    if (filter.read !== undefined && notification.read !== filter.read) {
      return false;
    }
    if (filter.since && notification.timestamp < filter.since) {
      return false;
    }
    if (filter.until && notification.timestamp > filter.until) {
      return false;
    }
    return true;
  }

  /**
   * Sort notifications based on sort criteria
   */
  private sortNotifications(notifications: Notification[], sort: NotificationSort): Notification[] {
    return notifications.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sort.field) {
        case 'timestamp':
          valueA = a.timestamp;
          valueB = b.timestamp;
          break;
        case 'type':
          valueA = a.type;
          valueB = b.type;
          break;
        case 'category':
          valueA = a.category;
          valueB = b.category;
          break;
        case 'read':
          valueA = a.read;
          valueB = b.read;
          break;
        default:
          valueA = a.timestamp;
          valueB = b.timestamp;
      }

      if (valueA < valueB) {
        return sort.order === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return sort.order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  /**
   * Query notifications with filtering, sorting, and pagination
   */
  query(query: NotificationQuery = {}): Notification[] {
    let results = Array.from(this.notifications.values());

    // Apply filters
    if (query.filter) {
      results = results.filter(notification => 
        this.matchesFilter(notification, query.filter!)
      );
    }

    // Apply sorting (default: newest first)
    const sort = query.sort || { field: 'timestamp', order: 'desc' };
    results = this.sortNotifications(results, sort);

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit;
    
    if (limit !== undefined) {
      results = results.slice(offset, offset + limit);
    } else if (offset > 0) {
      results = results.slice(offset);
    }

    return results;
  }

  /**
   * Get all notifications (convenience method)
   */
  getAll(): Notification[] {
    return this.query();
  }

  /**
   * Get unread notifications
   */
  getUnread(): Notification[] {
    return this.query({ filter: { read: false } });
  }

  /**
   * Get notifications by category
   */
  getByCategory(category: NotificationCategory): Notification[] {
    return this.query({ filter: { category } });
  }

  /**
   * Get notifications by type
   */
  getByType(type: NotificationType): Notification[] {
    return this.query({ filter: { type } });
  }

  /**
   * Get recent notifications (last 24 hours by default)
   */
  getRecent(hoursBack = 24): Notification[] {
    const since = Date.now() - (hoursBack * 60 * 60 * 1000);
    return this.query({ filter: { since } });
  }

  /**
   * Get notification statistics
   */
  getStats(): NotificationStats {
    const notifications = Array.from(this.notifications.values());
    const total = notifications.length;
    const unread = notifications.filter(n => !n.read).length;

    const byCategory: Record<NotificationCategory, number> = {
      general: 0,
      tasks: 0,
      chat: 0,
      documents: 0,
      system: 0,
      updates: 0
    };

    const byType: Record<NotificationType, number> = {
      info: 0,
      success: 0,
      warning: 0,
      error: 0,
      task: 0,
      system: 0,
      chat: 0,
      docs: 0
    };

    notifications.forEach(notification => {
      byCategory[notification.category]++;
      byType[notification.type]++;
    });

    return {
      total,
      unread,
      byCategory,
      byType
    };
  }

  /**
   * Subscribe to notification changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get the count of unread notifications
   */
  getUnreadCount(): number {
    return Array.from(this.notifications.values()).filter(n => !n.read).length;
  }

  /**
   * Clean up old notifications (older than specified days)
   */
  cleanup(olderThanDays = 30): number {
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    this.notifications.forEach((notification, id) => {
      if (notification.timestamp < cutoff) {
        this.notifications.delete(id);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      this.saveToStorage();
      this.notifyListeners();
    }

    return deletedCount;
  }
}

// Create and export a singleton instance
export const notificationsService = new NotificationsService();
export default notificationsService;