/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GoalModel = {
  /**
   * Goal id (UUID)
   */
  id: string
  /**
   * Owner user id
   */
  userId: string
  type: GoalModel.type
  category: GoalModel.category
  difficulty: GoalModel.difficulty
  text: string
  rating?: number
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
  state?: GoalModel.state
}
export namespace GoalModel {
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
  export enum state {
    ACTIVE = 'ACTIVE',
    CANCELLED = 'CANCELLED',
    DONE = 'DONE',
  }
}
