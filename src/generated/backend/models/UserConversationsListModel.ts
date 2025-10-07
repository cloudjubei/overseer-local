/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConversationLogModel } from './ConversationLogModel'
export type UserConversationsListModel = {
  items: Array<ConversationLogModel>
  /**
   * The cursor to use to fetch the next page of results.
   */
  nextCursor?: string
}
