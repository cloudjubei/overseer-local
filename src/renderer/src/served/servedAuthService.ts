import type { AuthService } from '../services/authService'
import { readServedAuth } from './servedUtils'

const served = readServedAuth(
  { baseUrl: import.meta.env.VITE_API_BASE_URL, token: import.meta.env.VITE_BEARER_TOKEN },
  window,
)

/**
 * Stands in for `services/authService` in the served build only (see
 * `vite.config.ts`): one fixed session on the fake backend. Nothing is stored,
 * so saving or clearing leaves it as it is.
 */
export const authService: AuthService = {
  get: async () => served,
  set: async () => served,
  clear: async () => served,
}
