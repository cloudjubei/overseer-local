/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TelegramLoginDto = {
  /**
   * Telegram user id
   */
  externalId: string
  /**
   * Pairing/access code provided by backend
   */
  accessCode: string
  /**
   * Shared secret from Telegram bot/app
   */
  secret: string
}
