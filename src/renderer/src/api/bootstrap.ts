/**
 * Configures the generated hey-api client exactly once and installs a single
 * response interceptor for 401 detection. Safe to call multiple times under
 * React StrictMode double-mounts: the prior interceptor is ejected before a
 * new one is installed.
 */
import type { AxiosError } from 'axios'
import { client } from '../generated/backend/client.gen'

export type BootstrapOptions = {
  baseUrl: string
  getToken: () => string | null
  onUnauthorized: () => void
  onAuthorized: () => void
}

let activeInterceptorId: number | null = null

export function configureBackendClient({
  baseUrl,
  getToken,
  onUnauthorized,
  onAuthorized,
}: BootstrapOptions): () => void {
  client.setConfig({
    baseURL: baseUrl.replace(/\/+$/, ''),
    auth: () => getToken() ?? undefined,
  })

  ejectActiveInterceptor()

  activeInterceptorId = client.instance.interceptors.response.use(
    (response) => {
      onAuthorized()
      return response
    },
    (error: AxiosError) => {
      if (error.response?.status === 401) onUnauthorized()
      return Promise.reject(error)
    },
  )

  return ejectActiveInterceptor
}

function ejectActiveInterceptor(): void {
  if (activeInterceptorId === null) return
  client.instance.interceptors.response.eject(activeInterceptorId)
  activeInterceptorId = null
}
