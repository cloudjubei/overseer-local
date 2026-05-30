import { useActiveProject, useProjectAppView } from 'thefactory-ui/headless'
import { ProjectAppView } from 'thefactory-ui/web'

export default function ProjectAppTab() {
  const { projectId } = useActiveProject()
  const { url, key, error } = useProjectAppView(projectId)

  return (
    <div className="w-full h-full bg-[var(--bg-surface)]">
      <ProjectAppView
        url={url}
        remountKey={key}
        fallback={
          <div className="flex h-full items-center justify-center p-8 text-center text-[var(--text-secondary)]">
            <div>
              <p className="text-base font-medium text-[var(--text-primary)]">
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
