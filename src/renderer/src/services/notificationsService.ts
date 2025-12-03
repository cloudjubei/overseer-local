import {
  Notification,
  NotificationMetadata,
  NotificationCreateInput,
} from 'src/types/notifications'

export type NotificationsService = {
  // outbound call
  onOpenNotification: (callback: (metadata: NotificationMetadata) => void) => () => void

  sendOs: (data: any) => Promise<void>
  subscribe: (callback: (payload?: any) => void) => () => void
  getRecentNotifications: (projectId: string) => Promise<Notification[]>
  getUnreadNotifications: (projectId: string) => Promise<Notification[]>
  markAllNotificationsAsRead: (projectId: string) => Promise<void>
  markNotificationAsRead: (projectId: string, id: string) => Promise<void>
  deleteAllNotifications: (projectId: string) => Promise<void>
  create: (projectId: string, input: NotificationCreateInput) => Promise<Notification>
}

export const notificationsService: NotificationsService = { ...window.notificationsService }
