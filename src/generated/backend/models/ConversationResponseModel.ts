/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConversationErrorModel } from './ConversationErrorModel'
import type { ConversationPromptModel } from './ConversationPromptModel'
import type { ConversationSuccessModel } from './ConversationSuccessModel'
export type ConversationResponseModel = {
  /**
   * Flow identifier
   */
  flow: string
  /**
   * Conversation session identifier
   */
  sessionId: string
  /**
   * Response type
   */
  type: ConversationResponseModel.type
  prompt?: ConversationPromptModel
  success?: ConversationSuccessModel
  error?: ConversationErrorModel
}
export namespace ConversationResponseModel {
  /**
   * Response type
   */
  export enum type {
    PROMPT = 'prompt',
    SUCCESS = 'success',
    ERROR = 'error',
  }
}
