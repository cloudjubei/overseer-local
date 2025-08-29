/**
 * Notification types and interfaces for the notifications system
 */

export type NotificationType = 
  | 'info' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'task' 
  | 'system' 
  | 'chat' 
  | 'files';

export type NotificationCategory = 
  | 'general'
  | 'tasks'
  | 'chat'
  | 'files'
  | 'system'
  | 'updates';

export interface NotificationMetadata {
  [key: string]: any;
  taskId?: string;
  featureId?: string;
  chatId?: string;
  documentPath?: string;
  actionUrl?: string;
  relatedEntityId?: string;
}

export interface Notification {
  id: string;
  timestamp: number; // Unix timestamp in milliseconds
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  read: boolean;
  metadata?: NotificationMetadata;
}

export interface NotificationCreateInput {
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}

export interface NotificationUpdateInput {
  read?: boolean;
  metadata?: NotificationMetadata;
}

export interface NotificationFilter {
  type?: NotificationType;
  category?: NotificationCategory;
  read?: boolean;
  since?: number; // Unix timestamp
  until?: number; // Unix timestamp
}

export interface NotificationSort {
  field: 'timestamp' | 'type' | 'category' | 'read';
  order: 'asc' | 'desc';
}

export interface NotificationQuery {
  filter?: NotificationFilter;
  sort?: NotificationSort;
  limit?: number;
  offset?: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
  byType: Record<NotificationType, number>;
}

export interface NotificationPreferences {
  osNotificationsEnabled: boolean;
  categoriesEnabled: Partial<Record<NotificationCategory, boolean>>;
  soundsEnabled: boolean;
  displayDuration: number; // seconds, 0 for persistent
}