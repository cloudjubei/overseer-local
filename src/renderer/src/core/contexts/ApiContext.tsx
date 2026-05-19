// Desktop wrapper around `thefactory-ui/headless`'s `ApiProvider`. The base
// URL is user-configured (read from `safeStorage` via `AuthContext`), so
// it may be null until the user supplies one — the headless provider
// handles that gracefully (no SDK configuration, idle ws).

import type { ReactNode } from 'react'
import { ApiProvider as HeadlessApiProvider } from 'thefactory-ui/headless'
import { useAuth } from './AuthContext'

export { useApi, type ApiContextValue } from 'thefactory-ui/headless'

export function ApiProvider({ children }: { children: ReactNode }) {
  const { baseUrl } = useAuth()
  return (
    <HeadlessApiProvider apiBaseUrl={baseUrl} wsBaseUrl={baseUrl}>
      {children}
    </HeadlessApiProvider>
  )
}
