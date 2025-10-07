/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserMoodModel } from './UserMoodModel'
export type MoodsListResultModel = {
  items: Array<UserMoodModel>
  /**
   * The cursor to use to fetch the next page of results.
   */
  nextCursor?: string
}
