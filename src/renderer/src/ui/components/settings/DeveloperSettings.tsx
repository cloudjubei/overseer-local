import { useSearchParams } from 'react-router-dom'
import { OverseerGitPanel, OverseerGitView, OverseerPanel, Switch } from 'thefactory-ui/web'
import { OverseerGitProvider, useAppSettings } from 'thefactory-ui/headless'
import BackendConnectionPanel from './BackendConnectionPanel'
import LinkRepoPanel from './LinkRepoPanel'

const GIT_SUBTAB = 'git'

/**
 * Debug mode: reveal the per-run DIAGNOSTICS (flight recorder) on the process
 * pipeline and run surfaces. Capture is always on server-side; this only
 * controls whether this viewer sees the Debug surfaces.
 */
function DebugModePanel() {
  const { settings, setUserPreferences } = useAppSettings()
  const on = settings.userPreferences.showRunDiagnostics === true
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-(--text-primary)">Debug mode</h3>
      <Switch
        checked={on}
        onCheckedChange={(v) => setUserPreferences({ showRunDiagnostics: v })}
        label="Show run diagnostics"
      />
      <p className="max-w-[60ch] text-xs text-(--text-secondary)">
        Adds a per-run “flight recorder” to the process pipeline — the pre-launch checks, launch
        summary and the reason behind a stuck or errored step. Runs always record it; this only
        shows it.
      </p>
    </section>
  )
}

export default function DeveloperSettings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const subtab = searchParams.get('subtab')

  const openGit = () => {
    const next = new URLSearchParams(searchParams)
    next.set('subtab', GIT_SUBTAB)
    setSearchParams(next)
  }

  const backToList = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('subtab')
    setSearchParams(next)
  }

  if (subtab === GIT_SUBTAB) {
    return (
      <OverseerGitProvider>
        <OverseerGitView onBack={backToList} />
      </OverseerGitProvider>
    )
  }

  // List mode owns its own padding so the parent `SettingsView` can give
  // `developer` an edge-to-edge wrapper (the Git subview needs the full
  // pane to itself).
  return (
    <div className="h-full min-h-0 overflow-y-auto p-4">
      <div className="flex flex-col gap-8">
        <BackendConnectionPanel />
        <OverseerPanel />
        <OverseerGitPanel onOpen={openGit} />
        <LinkRepoPanel />
        <DebugModePanel />
      </div>
    </div>
  )
}
