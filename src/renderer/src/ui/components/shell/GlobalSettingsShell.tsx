import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, ScreenErrorBoundary } from 'thefactory-ui/web'
import { assistantPath } from '@core/chats/assistantPath'
import SettingsView from '@ui/screens/SettingsView'
import { isOverseerGitSettings } from '../settings/developerSettingsRoute'
import Sidebar from './Sidebar'

export default function GlobalSettingsShell(): React.JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const goBack = (): void => {
    // HashRouter tracks the in-app history index. On a cold deep link there
    // is no previous app screen, so keep Back inside the app.
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(assistantPath(), { replace: true })
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar globalSettingsActive />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-(--border-subtle) px-4 py-2">
          {/* Git has its own Back to Developer. Only offer one Back at a time. */}
          {!isOverseerGitSettings(searchParams) && (
            <Button size="sm" variant="outline" onClick={goBack}>
              Back
            </Button>
          )}
          <h1 className="text-lg font-semibold">Settings</h1>
        </header>
        <div className="min-h-0 flex-1">
          <ScreenErrorBoundary screen="Settings">
            <SettingsView scope={{ kind: 'global' }} />
          </ScreenErrorBoundary>
        </div>
      </div>
    </div>
  )
}
