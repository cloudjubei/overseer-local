import { useApi } from '@core/contexts/ApiContext'
import { useAuth } from '@core/contexts/AuthContext'
import { BackendConnectionPanel as SharedBackendConnectionPanel } from 'thefactory-ui/web'

/**
 * Developer settings' backend connection: the shared panel over desktop's
 * `safeStorage`-backed `AuthContext`, which keeps both URL and token.
 */
export default function BackendConnectionPanel() {
  const { baseUrl, token, unauthorized, setToken, clearToken, setBaseUrl, clear } = useAuth()
  const { wsState } = useApi()
  return (
    <SharedBackendConnectionPanel
      clientName="this desktop client"
      baseUrl={baseUrl}
      token={token}
      wsState={wsState}
      unauthorized={unauthorized}
      onSaveUrl={(url) => void setBaseUrl(url)}
      onSaveToken={(next) => void setToken(next)}
      onClearToken={() => void clearToken()}
      onResetAll={() => void clear()}
    />
  )
}
