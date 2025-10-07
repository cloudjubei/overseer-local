/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ConversationLogModel = {
  /**
   * Flow identifier (session id)
   */
  flowId: string
  /**
   * Human-readable path like 'flow/step'
   */
  path: string
  /**
   * ISO date when the log entry was created
   */
  createdAt: string
  /**
   * Optional resolved user id
   */
  userId?: Record<string, any> | null
  /**
   * Raw input payload
   */
  input?: Record<string, any>
  /**
   * Optional context: channel
   */
  channel?: string
  /**
   * Optional context: externalId
   */
  externalId?: string
}
