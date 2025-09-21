import AppStorage from '../settings/AppStorage'

export default class NotificationsStorage {
  //TODO: transform into ts
  constructor(projectId) {
    this.projectId = projectId
    this.appStorage = new AppStorage('notifications')
    this.notifications = new Map()
    this.listeners = new Set()

    this.__loadFromStorage()
  }

  storageKey() {
    return `app_notifications__${this.projectId}`
  }
  prefsKey() {
    return `notification_preferences__${this.projectId}`
  }
  generateId() {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  __loadFromStorage() {
    try {
      const stored = this.appStorage.getItem(this.storageKey())
      if (stored) {
        const data = JSON.parse(stored)
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

  saveToStorage() {
    try {
      const data = Array.from(this.notifications.values())
      this.appStorage.setItem(this.storageKey(), JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save notifications to storage:', error)
    }
  }

  notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener()
      } catch {}
    })
  }

  create(input) {
    const notification = {
      id: this.generateId(),
      timestamp: Date.now(),
      type: input.type,
      category: input.category,
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

  getById(id) {
    return this.notifications.get(id) || null
  }

  update(id, updates) {
    const notification = this.notifications.get(id)
    if (!notification) {
      return null
    }

    const updatedNotification = {
      ...notification,
      ...updates,
      metadata: updates.metadata
        ? { ...notification.metadata, ...updates.metadata }
        : notification.metadata,
    }

    this.notifications.set(id, updatedNotification)
    this.saveToStorage()
    this.notifyListeners()

    return updatedNotification
  }

  delete(id) {
    const existed = this.notifications.has(id)
    if (existed) {
      this.notifications.delete(id)
      this.saveToStorage()
      this.notifyListeners()
    }
    return existed
  }

  markAsRead(id) {
    return this.update(id, { read: true })
  }

  markAsUnread(id) {
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

  __matchesFilter(notification, filter) {
    if (filter.type && notification.type !== filter.type) {
      return false
    }
    if (filter.category && notification.category !== filter.category) {
      return false
    }
    if (filter.read !== undefined && notification.read !== filter.read) {
      return false
    }
    if (filter.since && notification.timestamp < filter.since) {
      return false
    }
    if (filter.until && notification.timestamp > filter.until) {
      return false
    }
    return true
  }

  __sortNotifications(notifications, sort) {
    return notifications.sort((a, b) => {
      let valueA
      let valueB

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

      if (valueA < valueB) {
        return sort.order === 'asc' ? -1 : 1
      }
      if (valueA > valueB) {
        return sort.order === 'asc' ? 1 : -1
      }
      return 0
    })
  }

  query(query = {}) {
    let results = Array.from(this.notifications.values())

    if (query.filter) {
      results = results.filter((notification) => this.__matchesFilter(notification, query.filter))
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

  getAll() {
    return this.query()
  }

  getUnread() {
    return this.query({ filter: { read: false } })
  }

  getByCategory(category) {
    return this.query({ filter: { category } })
  }

  getByType(type) {
    return this.query({ filter: { type } })
  }

  getRecent(hoursBack = 24) {
    const since = Date.now() - hoursBack * 60 * 60 * 1000
    return this.query({ filter: { since } })
  }

  getStats() {
    const notifications = Array.from(this.notifications.values())
    const total = notifications.length
    const unread = notifications.filter((n) => !n.read).length

    const byCategory = {
      general: 0,
      tasks: 0,
      chat: 0,
      documents: 0,
      system: 0,
      updates: 0,
    }

    const byType = {
      info: 0,
      success: 0,
      warning: 0,
      error: 0,
      task: 0,
      system: 0,
      chat: 0,
      docs: 0,
    }

    notifications.forEach((notification) => {
      byCategory[notification.category] = (byCategory[notification.category] || 0) + 1
      byType[notification.type] = (byType[notification.type] || 0) + 1
    })

    return {
      total,
      unread,
      byCategory,
      byType,
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getUnreadCount() {
    return Array.from(this.notifications.values()).filter((n) => !n.read).length
  }

  cleanup(olderThanDays = 30) {
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
}
