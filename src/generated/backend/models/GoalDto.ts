/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserMoodDto } from './UserMoodDto'
export type GoalDto = {
  /**
   * Goal id (UUID)
   */
  id: string
  /**
   * Owner user id
   */
  userId: string
  type: GoalDto.type
  category: GoalDto.category
  difficulty: GoalDto.difficulty
  text: string
  moods: Array<UserMoodDto>
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
}
export namespace GoalDto {
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
