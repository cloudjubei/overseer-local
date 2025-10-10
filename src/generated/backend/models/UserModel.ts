/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserProfileModel } from './UserProfileModel'
export type UserModel = {
  /**
   * The unique identifier for the user.
   */
  id: string
  /**
   * The user's profile.
   */
  profile: UserProfileModel
  /**
   * The user's email address.
   */
  email?: string
  /**
   * The user's telegramId
   */
  telegramId?: string
}
