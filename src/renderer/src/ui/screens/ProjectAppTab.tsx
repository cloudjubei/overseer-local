import {
  useActiveProject,
  useProjectAppView,
  useProjectDataBridge,
} from 'thefactory-ui/headless'
import { ModelChipConnected, ProjectAppView } from 'thefactory-ui/web'

/**
 * Desktop peer of the App tab. Mirrors web's `ProjectAppTab` 1:1 — the
 * Electron renderer is Chromium, so it reuses the web `ProjectAppView` with the
 * activity-model chip (the LLM config the app's background activities run on)
 * floated over the surface's top-right, aligned with the app's own tab row.
 * `useProjectDataBridge` services the embedded app's `overseer:data.*` requests
 * against the active project; the write credential stays in the host.
 */
export default function ProjectAppTab() {
  const { projectId } = useActiveProject()
  const { url, key, error } = useProjectAppView(projectId)
  const onBridgeMessage = useProjectDataBridge(projectId)

  return (
    <div className="flex w-full h-full flex-col bg-(--bg-surface)">
      <div className="flex-1 min-h-0">
        <ProjectAppView
          url={url}
          remountKey={key}
          onBridgeMessage={onBridgeMessage}
          topRightOverlay={<ModelChipConnected editable mode="activity" />}
          fallback={
            <div className="flex h-full items-center justify-center p-8 text-center text-(--text-secondary)">
              <div>
                <p className="text-base font-medium text-(--text-primary)">
                  {error ? 'App view unavailable' : 'No app to view yet'}
                </p>
                <p className="mt-2 text-sm">
                  {error
                    ? error.message
                    : 'Run a story to scaffold this project’s app surface, then come back to this tab.'}
                </p>
              </div>
            </div>
          }
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}
