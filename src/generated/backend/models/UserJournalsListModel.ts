/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { JournalModel } from './JournalModel'
export type UserJournalsListModel = {
  /**
   * The list of user journals.
   */
  items: Array<JournalModel>
  /**
   * The cursor to use to fetch the next page of results.
   */
  nextCursor?: string
}
