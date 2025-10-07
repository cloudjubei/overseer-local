/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { JournalModel } from './JournalModel'
export type GoalStepModel = {
  id: string
  userId: string
  /**
   * The goal this step belongs to
   */
  goalId: string
  /**
   * When the step record was created
   */
  createdAt: string
  /**
   * When the step was completed (defaults to createdAt)
   */
  completedAt: string
  /**
   * When the step record was last updated
   */
  updatedAt?: string
  /**
   * Journal entry associated with this step
   */
  journal: JournalModel
}
