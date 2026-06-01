import { useActiveProject, useProjectAppView } from 'thefactory-ui/headless'
import { ProjectAppView } from 'thefactory-ui/web'

/**
 * Desktop peer of the App tab. Mirrors web's `ProjectAppTab` 1:1 — the
 * Electron renderer is Chromium, so it reuses the web `ProjectAppView`. The
 * App↔Overseer bridge transport is available via `onBridgeMessage`; the first
 * real handlers (`data.*`) land with live-data Stage 1.
 */
export default function ProjectAppTab() {
  const { projectId } = useActiveProject()
  const { url, key, error } = useProjectAppView(projectId)

  return (
    <div className="w-full h-full bg-(--bg-surface)">
      <ProjectAppView
        url={url}
        remountKey={key}
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
  )
}
