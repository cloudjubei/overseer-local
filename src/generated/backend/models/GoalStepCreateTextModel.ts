/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GoalStepCreateTextModel = {
  /**
   * Explicit goal id. If omitted, the current active goal will be used.
   */
  goalId?: string
  /**
   * The journal text content for this step
   */
  text: string
  /**
   * Completion timestamp; defaults to createdAt if omitted
   */
  completedAt?: string
}
