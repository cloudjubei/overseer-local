/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type LoginResultDto = {
  /**
   * JWT ID token
   */
  idToken: string
  /**
   * JWT access token
   */
  accessToken: string
  /**
   * Refresh token if provided by auth provider
   */
  refreshToken?: string
  /**
   * Seconds until token expiry
   */
  expiresIn?: number
  /**
   * Token type, e.g., Bearer
   */
  tokenType?: string
}
