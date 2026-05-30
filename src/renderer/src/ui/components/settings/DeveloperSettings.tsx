import { useSearchParams } from 'react-router-dom'
import { OverseerGitPanel, OverseerGitView, OverseerPanel } from 'thefactory-ui/web'
import { OverseerGitProvider } from 'thefactory-ui/headless'
import BackendConnectionPanel from './BackendConnectionPanel'
import LinkRepoPanel from './LinkRepoPanel'

const GIT_SUBTAB = 'git'

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
      </div>
    </div>
  )
}
