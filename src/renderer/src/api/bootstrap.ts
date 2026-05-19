/**
 * Configures the generated hey-api client and installs the request/response
 * interceptors the renderer relies on. Safe to call multiple times under
 * React StrictMode double-mounts: any prior interceptors are ejected before
 * new ones are installed.
 *
 * Authorization is owned end-to-end by the request interceptor: the bearer
 * header is set on every outgoing request, and any axios `auth` field is
 * stripped so the adapter never tries to compute HTTP Basic on top. We don't
 * delegate to hey-api's `config.auth`: routing it through `axios.defaults`
 * lets the xhr adapter synthesise a Basic header from the function value
 * (`btoa(':')`), which then overwrites the bearer set by `setAuthParams`.
 */
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { client } from '../generated/backend/client.gen'

export type BootstrapOptions = {
  baseUrl: string
  getToken: () => string | null
  onUnauthorized: () => void
  onAuthorized: () => void
}

let activeRequestInterceptorId: number | null = null
let activeResponseInterceptorId: number | null = null

export function configureBackendClient({
  baseUrl,
  getToken,
  onUnauthorized,
  onAuthorized,
}: BootstrapOptions): () => void {
  client.setConfig({
    baseURL: baseUrl.replace(/\/+$/, ''),
  })

  ejectActiveInterceptors()

  activeRequestInterceptorId = client.instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Strip any axios `auth` so the xhr adapter doesn't synthesise a Basic
      // Authorization header that would overwrite the bearer set below.
      if ('auth' in config) {
        delete (config as { auth?: unknown }).auth
      }
      const token = getToken()
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`)
      }
      return config
    },
  )

  activeResponseInterceptorId = client.instance.interceptors.response.use(
    (response) => {
      onAuthorized()
      return response
    },
    (error: AxiosError) => {
      if (error.response?.status === 401) onUnauthorized()
      return Promise.reject(error)
    },
  )

  return ejectActiveInterceptors
}

function ejectActiveInterceptors(): void {
  if (activeRequestInterceptorId !== null) {
    client.instance.interceptors.request.eject(activeRequestInterceptorId)
    activeRequestInterceptorId = null
  }
  if (activeResponseInterceptorId !== null) {
    client.instance.interceptors.response.eject(activeResponseInterceptorId)
    activeResponseInterceptorId = null
  }
}
