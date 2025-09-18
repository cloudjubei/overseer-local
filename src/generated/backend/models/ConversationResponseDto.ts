/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConversationErrorDto } from './ConversationErrorDto'
import type { ConversationPromptDto } from './ConversationPromptDto'
import type { ConversationSuccessDto } from './ConversationSuccessDto'
export type ConversationResponseDto = {
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
  type: ConversationResponseDto.type
  prompt?: ConversationPromptDto
  success?: ConversationSuccessDto
  error?: ConversationErrorDto
}
export namespace ConversationResponseDto {
  /**
   * Response type
   */
  export enum type {
    PROMPT = 'prompt',
    SUCCESS = 'success',
    ERROR = 'error',
  }
}
