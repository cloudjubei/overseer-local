import { useState } from 'react'
import CollapsibleSidebar from '@renderer/components/ui/CollapsibleSidebar'
import { useNotifications } from '@renderer/hooks/useNotifications'
import { Button } from '@renderer/components/ui/Button'
import { IconBell, IconChat } from '@renderer/components/ui/icons/Icons'
import { Notification } from 'src/types/notifications'
import { useNavigator } from '@renderer/navigation/Navigator'

const SECTIONS = [
  { id: 'general', label: 'General', icon: <IconBell />, accent: 'brand' },
  { id: 'messages', label: 'Messages', icon: <IconChat />, accent: 'teal' },
]
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function getIconForType(type: Notification['type']): string {
  switch (type) {
    case 'info':
      return 'ℹ️'
    case 'success':
      return '✅'
    case 'warning':
      return '⚠️'
    case 'error':
      return '❌'
    case 'story':
      return '📋'
    case 'system':
      return '🖥️'
    case 'chat':
      return '💬'
    case 'files':
      return '📄'
    default:
      return '🔔'
  }
}

export default function NotificationsView() {
  const [activeSection, setActiveSection] = useState('general')
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications()
  const nav = useNavigator()

  const handleClick = (notification: Notification) => {
    // Mark as read if needed
    if (!notification.read) markAsRead(notification.id)

    // Deep-link to Agent Run when available
    const runId = notification.metadata?.runId
    if (runId) {
      nav.navigateAgentRun(runId)
      return
    }

    // Future: handle other metadata targets if present (storyId, chatId, documentPath)
  }

  return (
    <CollapsibleSidebar
      items={SECTIONS}
      activeId={activeSection}
      onSelect={setActiveSection}
      storageKey="notifications-panel-collapsed"
      headerTitle="Categories"
      headerSubtitle=""
    >
      <div className="p-4">
        {activeSection === 'general' && (
          <div>
            <h2 className="text-xl font-semibold mb-3">General Notifications</h2>

            <div className="flex flex-col h-full p-4 bg-background">
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Notifications ({unreadCount} unread)</h1>
                <div className="space-x-2">
                  <Button onClick={markAllAsRead} variant="secondary">
                    Mark all as read
                  </Button>
                  <Button onClick={clearAll} variant="danger">
                    Clear all
                  </Button>
                </div>
              </div>
              <div className="overflow-auto flex-1">
                {notifications.length === 0 ? (
                  <p className="text-muted-foreground">No notifications</p>
                ) : (
                  <ul className="space-y-2">
                    {notifications.map((notification) => (
                      <li
                        key={notification.id}
                        className={`p-3 rounded-md border ${notification.read ? 'bg-muted' : 'bg-background border-primary'}`}
                        onClick={() => handleClick(notification)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="flex items-start space-x-3">
                          <span className="text-2xl">{getIconForType(notification.type)}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-baseline">
                              <h3
                                className={`font-semibold ${notification.read ? 'text-muted-foreground' : ''}`}
                              >
                                {notification.title}
                              </h3>
                              <span className="text-sm text-muted-foreground">
                                {formatTimestamp(notification.timestamp)}
                              </span>
                            </div>
                            <p className={notification.read ? 'text-muted-foreground' : ''}>
                              {notification.message}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
        {activeSection === 'messages' && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Messages</h2>
            {/* TODO: Implement messages list */}
            <p>Placeholder for message notifications.</p>
          </div>
        )}
      </div>
    </CollapsibleSidebar>
  )
}
