/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserMomentumModel = {
  /**
   * User id
   */
  userId: string
  /**
   * Number of consecutive days user has completed micro goals
   */
  microGoalsConsecutive: number
  /**
   * Motivational text for the user
   */
  motivationText?: string
  /**
   * ISO8601 timestamp
   */
  createdAt: string
  /**
   * ISO8601 timestamp
   */
  updatedAt: string
}
