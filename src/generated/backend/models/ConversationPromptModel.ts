/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PromptFieldModel } from './PromptFieldModel'
import type { PromptOptionModel } from './PromptOptionModel'
export type ConversationPromptModel = {
  /**
   * Optional prompt title
   */
  title?: string
  /**
   * Main message/instruction for the user
   */
  message: string
  /**
   * Form-like input fields
   */
  fields: Array<PromptFieldModel>
  /**
   * Menu-like options (e.g., buttons)
   */
  options?: Array<PromptOptionModel>
  /**
   * Key name that the client should use to submit a selected option (defaults to "selection")
   */
  selectionName?: string
  /**
   * Submit button label
   */
  submitLabel?: string
}
