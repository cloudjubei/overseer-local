/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MoodAnalysisResultDto } from './MoodAnalysisResultDto'
export type GoalModel = {
  /**
   * Goal id (UUID)
   */
  id: string
  /**
   * Owner user id
   */
  userId: string
  /**
   * Reference to another goal
   */
  referenceId: string
  state: GoalModel.state
  type: GoalModel.type
  category?: GoalModel.category
  difficulty?: GoalModel.difficulty
  text: string
  mood?: MoodAnalysisResultDto
  /**
   * ISO8601 timestamp
   */
  createdAt: string
  /**
   * ISO8601 timestamp
   */
  updatedAt: string
  /**
   * ISO8601 timestamp when completed
   */
  completedAt?: string
}
export namespace GoalModel {
  export enum state {
    ACTIVE = 'ACTIVE',
    CANCELLED = 'CANCELLED',
    FAIL = 'FAIL',
    SUCCESS = 'SUCCESS',
  }
  export enum type {
    MACRO = 'MACRO',
    MICRO = 'MICRO',
  }
  export enum category {
    FITNESS = 'FITNESS',
    SLEEP = 'SLEEP',
    FOCUS = 'FOCUS',
    STRESS = 'STRESS',
    OTHER = 'OTHER',
  }
  export enum difficulty {
    EASY = 'EASY',
    MEDIUM = 'MEDIUM',
    HARD = 'HARD',
  }
}
