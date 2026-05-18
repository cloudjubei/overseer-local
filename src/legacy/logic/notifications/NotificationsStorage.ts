import AppStorage from '../settings/AppStorage'
import type {
  Notification as AppNotification,
  NotificationCreateInput,
  NotificationUpdateInput,
  NotificationQuery,
  NotificationCategory,
  NotificationType,
} from '../../types/notifications'

export type NotificationsListener = () => void

export default class NotificationsStorage {
  private projectId: string
  private appStorage: AppStorage
  private notifications: Map<string, AppNotification>
  private listeners: Set<NotificationsListener>

  constructor(projectId: string) {
    this.projectId = projectId
    this.appStorage = new AppStorage('notifications')
    this.notifications = new Map()
    this.listeners = new Set()
    this.__loadFromStorage()
  }

  private storageKey(): string {
    return `app_notifications__${this.projectId}`
  }

  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private __loadFromStorage(): void {
    try {
      const stored = this.appStorage.getItem(this.storageKey())
      if (stored) {
        const data = JSON.parse(stored) as AppNotification[]
        this.notifications = new Map()
        data.forEach((notification) => {
          this.notifications.set(notification.id, notification)
        })
      } else {
        this.notifications = new Map()
      }
    } catch (error) {
      console.error('Failed to load notifications from storage:', error)
      this.notifications = new Map()
    }
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.notifications.values())
      this.appStorage.setItem(this.storageKey(), JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save notifications to storage:', error)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener()
      } catch {}
    })
  }

  create(input: NotificationCreateInput): AppNotification {
    const notification: AppNotification = {
      id: this.generateId(),
      timestamp: Date.now(),
      type: input.type as NotificationType,
      category: input.category as NotificationCategory,
      title: input.title,
      message: input.message,
      read: false,
      metadata: { ...(input.metadata || {}), projectId: this.projectId },
    }

    this.notifications.set(notification.id, notification)
    this.saveToStorage()
    this.notifyListeners()

    return notification
  }

  getById(id: string): AppNotification | null {
    return this.notifications.get(id) || null
  }

  update(
    id: string,
    updates: NotificationUpdateInput & Partial<AppNotification>,
  ): AppNotification | null {
    const notification = this.notifications.get(id)
    if (!notification) return null

    const updatedNotification: AppNotification = {
      ...notification,
      ...updates,
      metadata: updates.metadata
        ? { ...(notification.metadata || {}), ...updates.metadata }
        : notification.metadata,
    }

    this.notifications.set(id, updatedNotification)
    this.saveToStorage()
    this.notifyListeners()

    return updatedNotification
  }

  delete(id: string): boolean {
    const existed = this.notifications.has(id)
    if (existed) {
      this.notifications.delete(id)
      this.saveToStorage()
      this.notifyListeners()
    }
    return existed
  }

  markAsRead(id: string): AppNotification | null {
    return this.update(id, { read: true })
  }

  markAsUnread(id: string): AppNotification | null {
    return this.update(id, { read: false })
  }

  markAllAsRead() {
    let hasChanges = false
    this.notifications.forEach((notification, id) => {
      if (!notification.read) {
        this.notifications.set(id, { ...notification, read: true })
        hasChanges = true
      }
    })

    if (hasChanges) {
      this.saveToStorage()
      this.notifyListeners()
    }
  }

  deleteAll() {
    if (this.notifications.size > 0) {
      this.notifications = new Map()
      this.saveToStorage()
      this.notifyListeners()
    }
  }

  query(query: NotificationQuery = {}): AppNotification[] {
    let results = Array.from(this.notifications.values())

    if (query.filter) {
      results = results.filter((n) => this.__matchesFilter(n, query.filter!))
    }

    results = this.__sortNotifications(results, query.sort || { field: 'timestamp', order: 'desc' })

    const offset = query.offset || 0
    const limit = query.limit

    if (limit !== undefined) {
      results = results.slice(offset, offset + limit)
    } else if (offset > 0) {
      results = results.slice(offset)
    }

    return results
  }

  getAll(): AppNotification[] {
    return this.query()
  }

  getUnread(): AppNotification[] {
    return this.query({ filter: { read: false } })
  }

  getByCategory(category: NotificationCategory): AppNotification[] {
    return this.query({ filter: { category } })
  }

  getByType(type: NotificationType): AppNotification[] {
    return this.query({ filter: { type } })
  }

  getRecent(hoursBack = 24): AppNotification[] {
    const since = Date.now() - hoursBack * 60 * 60 * 1000
    return this.query({ filter: { since } })
  }

  subscribe(listener: NotificationsListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  cleanup(olderThanDays = 30): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    let deletedCount = 0

    this.notifications.forEach((notification, id) => {
      if (notification.timestamp < cutoff) {
        this.notifications.delete(id)
        deletedCount++
      }
    })

    if (deletedCount > 0) {
      this.saveToStorage()
      this.notifyListeners()
    }

    return deletedCount
  }

  private __matchesFilter(
    notification: AppNotification,
    filter: NonNullable<NotificationQuery['filter']>,
  ): boolean {
    if (filter.type && notification.type !== filter.type) return false
    if (filter.category && notification.category !== filter.category) return false
    if (filter.read !== undefined && notification.read !== filter.read) return false
    if (filter.since && notification.timestamp < filter.since) return false
    if (filter.until && notification.timestamp > filter.until) return false
    return true
  }

  private __sortNotifications(
    notifications: AppNotification[],
    sort: NonNullable<NotificationQuery['sort']>,
  ): AppNotification[] {
    return notifications.sort((a, b) => {
      let valueA: any
      let valueB: any

      switch (sort.field) {
        case 'timestamp':
          valueA = a.timestamp
          valueB = b.timestamp
          break
        case 'type':
          valueA = a.type
          valueB = b.type
          break
        case 'category':
          valueA = a.category
          valueB = b.category
          break
        case 'read':
          valueA = a.read
          valueB = b.read
          break
        default:
          valueA = a.timestamp
          valueB = b.timestamp
      }

      if (valueA < valueB) return sort.order === 'asc' ? -1 : 1
      if (valueA > valueB) return sort.order === 'asc' ? 1 : -1
      return 0
    })
  }
}
