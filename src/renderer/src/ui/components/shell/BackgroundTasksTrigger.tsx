import { useState } from 'react'
import { useAppSettings, useCrossProjectRequests, formatBadgeCount } from 'thefactory-ui/headless'
import {
  BackgroundTasksPanel,
  Button,
  Modal,
  NotificationBadge,
  type FeatureRequestCardData,
  type FeatureRequestCardStatus,
} from 'thefactory-ui/web'
import { IconList } from 'thefactory-ui/web/icons'

/**
 * Desktop peer of web's `BackgroundTasksTrigger` (1:1). The account-global cross-project inspector:
 * reads the global feature-request store (mounted once at the shell), shows the pending+in-flight
 * badge (gated on the `cross-project` toggle), and opens a modal listing every request with
 * accept/reject. Mounted in the Sidebar header.
 */
export default function BackgroundTasksTrigger() {
  const { settings } = useAppSettings()
  const { requests, badgeCount, accept, reject } = useCrossProjectRequests()
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | undefined>(undefined)

  const badgeEnabled = settings.notifications.badgesEnabled['cross-project'] !== false
  const badgeColor = settings.notifications.badgeColors['cross-project']

  const rows: FeatureRequestCardData[] = requests.map((fr) => ({
    id: fr.id,
    title: fr.title,
    targetProjectId: fr.targetProjectId,
    fromProjectId: fr.requestedBy.fromProjectId,
    status: fr.status as FeatureRequestCardStatus,
    cycleDetected: fr.cycleFlag?.detected,
    reviewBranch: fr.result?.reviewBranch,
  }))

  const decide = (fn: (id: string) => Promise<unknown>) => async (id: string) => {
    setBusyId(id)
    try {
      await fn(id)
    } finally {
      setBusyId(undefined)
    }
  }

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Background tasks"
          title="Background tasks"
        >
          <IconList />
        </Button>
        {badgeEnabled && badgeCount > 0 ? (
          <div className="pointer-events-none absolute -right-1 -top-1">
            <NotificationBadge text={formatBadgeCount(badgeCount)} color={badgeColor} />
          </div>
        ) : null}
      </div>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Background tasks" size="md">
        <BackgroundTasksPanel
          requests={rows}
          busyId={busyId}
          onAccept={decide(accept)}
          onReject={decide(reject)}
        />
      </Modal>
    </>
  )
}
