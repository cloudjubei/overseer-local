/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type HandleInputDto = {
  /**
   * Flow name being continued
   */
  flow: string
  /**
   * Current session id
   */
  sessionId: string
  /**
   * Input payload for the current prompt
   */
  input: Record<string, any>
  /**
   * Conversation channel (e.g., telegram)
   */
  channel: HandleInputDto.channel
  /**
   * External user id for the channel (e.g., Telegram user id)
   */
  externalId?: string
}
export namespace HandleInputDto {
  /**
   * Conversation channel (e.g., telegram)
   */
  export enum channel {
    TELEGRAM = 'telegram',
    WEB = 'web',
    UNKNOWN = 'unknown',
  }
}
