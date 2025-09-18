import { config } from '../config/env'
import { OpenAPI } from '../generated/backend/core/OpenAPI'

export interface AuthTokens {
  accessToken?: string 
}

export function configureBackendClient(tokens?: AuthTokens) {
  OpenAPI.BASE = config.backendBaseUrl
  OpenAPI.WITH_CREDENTIALS = false
  setAccessToken(tokens?.accessToken)
}

export function setAccessToken(accessToken?: string) {
  OpenAPI.TOKEN = accessToken
}
