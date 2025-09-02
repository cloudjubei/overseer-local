import { Notification, NotificationMetadata } from "src/types/notifications"
import { ProjectSpec } from "packages/factory-ts/src/types"
import { ServiceResult } from "./serviceResult"

export type NotificationsService = {
  //outbound call
  onOpenNotification: (callback: (metadata: NotificationMetadata) => void) => () => void

  sendOs: (data: any) => Promise<ServiceResult>
  subscribe: (callback: (notifications: Notification[]) => void) => () => void
  getRecentNotifications: (projectId: string) => Promise<Notification[]>
  getUnreadNotificationsCount: (projectId: string) => Promise<number>
  markAllNotificationsAsRead: (projectId: string) => Promise<void>
  markNotificationAsRead: (projectId: string, id: string) => Promise<void>
  deleteAllNotifications: (projectId: string) => Promise<void>
}


export const notificationsService: NotificationsService = { ...window.notificationsService }
