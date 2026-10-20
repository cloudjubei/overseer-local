import { DisconnectedBanner as SharedDisconnectedBanner } from 'thefactory-ui/web'
import { useApi } from '@core/contexts/ApiContext'
import { useAuth } from '@core/contexts/AuthContext'

/**
 * The shared `DisconnectedBanner` web mounts, shown once both halves of the
 * connection are configured — before that the LoginScreen owns the user's
 * attention.
 */
export default function DisconnectedBanner(): React.JSX.Element {
  const { token, baseUrl } = useAuth()
  const { wsState } = useApi()
  return <SharedDisconnectedBanner wsState={wsState} visible={!!token && !!baseUrl} />
}
