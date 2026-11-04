import {
  SERVED_BACKEND_HOST,
  SERVED_ELECTRON_BRIDGES,
  SERVED_FAKE_TOKEN_PREFIX,
  SERVED_NOT_FAKE_TOKEN,
  SERVED_NOT_FAKE_URL,
  SERVED_ON_ELECTRON,
} from './servedConstants'
import type { ServedAuth, ServedEnv, ServedHost } from './servedTypes'

function isFakeBackendUrl(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname === SERVED_BACKEND_HOST
  } catch {
    return false
  }
}

/**
 * The fake backend a served build runs on. Throws, rather than return anything
 * else, inside the Electron app and for a token or a URL no serve would make:
 * this is the one way env values reach the renderer, so it is what keeps them
 * from standing in for `safeStorage` or pointing at a real backend.
 */
export function readServedAuth(env: ServedEnv, host: ServedHost): ServedAuth {
  if (SERVED_ELECTRON_BRIDGES.some((bridge) => host[bridge] !== undefined)) {
    throw new Error(SERVED_ON_ELECTRON)
  }
  const { baseUrl, token } = env
  if (!token?.startsWith(SERVED_FAKE_TOKEN_PREFIX)) throw new Error(SERVED_NOT_FAKE_TOKEN)
  if (!baseUrl || !isFakeBackendUrl(baseUrl)) throw new Error(SERVED_NOT_FAKE_URL)
  return { baseUrl, token }
}
