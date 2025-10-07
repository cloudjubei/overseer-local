/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserModel } from './UserModel'
export type UsersListModel = {
  /**
   * The list of users.
   */
  items: Array<UserModel>
  /**
   * The cursor to use to fetch the next page of results.
   */
  nextCursor?: string
}
