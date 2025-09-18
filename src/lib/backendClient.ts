// Helper to configure the generated OpenAPI client at runtime
// Assumes openapi-typescript-codegen output with core/OpenAPI export exists under src/generated/backend
// This file is safe to import before generation; at runtime ensure the client is generated.

import { config } from '../config/env'

// Lazy import type to avoid hard dependency before generation
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - types are available after generation
import { OpenAPI } from '../generated/backend/core/OpenAPI'

export interface AuthTokens {
  accessToken?: string // JWT access token from backend (bearer)
}

export function configureBackendClient(tokens?: AuthTokens) {
  // openapi-typescript-codegen's OpenAPI object controls base and headers
  OpenAPI.BASE = config.backendBaseUrl
  OpenAPI.WITH_CREDENTIALS = false
  OpenAPI.TOKEN = tokens?.accessToken ? async () => tokens!.accessToken! : undefined
}

export function setAccessToken(accessToken?: string) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  import('../generated/backend/core/OpenAPI').then(({ OpenAPI }) => {
    if (accessToken) {
      OpenAPI.TOKEN = async () => accessToken
    } else {
      OpenAPI.TOKEN = undefined
    }
  })
}
