import { Notification, NotificationMetadata, NotificationCreateInput } from "src/types/notifications"
import { ServiceResult } from "./serviceResult"

export type NotificationsService = {
  // outbound call
  onOpenNotification: (callback: (metadata: NotificationMetadata) => void) => () => void

  sendOs: (data: any) => Promise<ServiceResult>
  subscribe: (callback: (payload?: any) => void) => () => void
  getRecentNotifications: (projectId: string) => Promise<Notification[]>
  getUnreadNotificationsCount: (projectId: string) => Promise<number>
  markAllNotificationsAsRead: (projectId: string) => Promise<void>
  markNotificationAsRead: (projectId: string, id: string) => Promise<void>
  deleteAllNotifications: (projectId: string) => Promise<void>
  create: (projectId: string, input: NotificationCreateInput) => Promise<Notification>
}

export const notificationsService: NotificationsService = { ...window.notificationsService as any }
