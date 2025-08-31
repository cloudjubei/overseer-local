import { Notification, NotificationMetadata, NotificationProjectPreferences, NotificationSystemPreferences } from "src/types/notifications"
import { ProjectSpec } from "src/types/tasks"
import { ServiceResult } from "./serviceResult"

export type NotificationsService = {
  //outbound call
  onOpenNotification: (callback: (metadata: NotificationMetadata) => void) => () => void

  sendOs: (data: any) => Promise<ServiceResult>
  subscribe: (callback: () => void) => () => void
  getRecentNotifications: (project: ProjectSpec) => Promise<Notification[]>
  getUnreadNotificationsCount: (project: ProjectSpec) => Promise<number>
  markAllNotificationsAsRead: (project: ProjectSpec) => Promise<void>
  markNotificationAsRead: (project: ProjectSpec, id: string) => Promise<void>
  deleteAllNotifications: (project: ProjectSpec) => Promise<void>
  getSystemPreferences: () => Promise<NotificationSystemPreferences>
  updateSystemPreferences: (updates: Partial<NotificationSystemPreferences>) => Promise<NotificationSystemPreferences>
  getProjectPreferences: (project: ProjectSpec) => Promise<NotificationProjectPreferences>
  updateProjectPreferences: (project: ProjectSpec, updates: Partial<NotificationProjectPreferences>) => Promise<NotificationProjectPreferences>
}


export const notificationsService: NotificationsService = { ...window.notificationsService }
