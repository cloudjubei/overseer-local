/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserActivityLogModel = {
  /**
   * ISO date when the activity was recorded
   */
  timestamp: string
  /**
   * Resolved user id
   */
  userId: string
  /**
   * HTTP method
   */
  method: string
  /**
   * Request path
   */
  path: string
  /**
   * HTTP status code of the response
   */
  statusCode?: number
  /**
   * Unique request identifier
   */
  requestId?: string
  /**
   * IP address of the client
   */
  ip?: string
  /**
   * User agent of the client
   */
  userAgent?: string
}
