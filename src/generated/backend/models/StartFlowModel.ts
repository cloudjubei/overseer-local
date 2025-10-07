/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type StartFlowModel = {
  /**
   * Flow name to start. Use 'auto' to infer from free-text.
   */
  flow: string
  /**
   * Optional client-provided session id to resume.
   */
  sessionId?: string
  /**
   * Conversation channel (e.g., telegram)
   */
  channel: StartFlowModel.channel
  /**
   * External user id for the channel (e.g., Telegram user id)
   */
  externalId?: string
  /**
   * Free-form user text to infer intent when flow='auto'.
   */
  text?: string
}
export namespace StartFlowModel {
  /**
   * Conversation channel (e.g., telegram)
   */
  export enum channel {
    TELEGRAM = 'telegram',
    WEB = 'web',
    UNKNOWN = 'unknown',
  }
}
