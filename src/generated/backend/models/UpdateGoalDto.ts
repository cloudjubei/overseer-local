/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateMoodDto } from './CreateMoodDto'
export type UpdateGoalDto = {
  type?: UpdateGoalDto.type
  category?: UpdateGoalDto.category
  difficulty?: UpdateGoalDto.difficulty
  text?: string
  moods?: Array<CreateMoodDto>
  rating?: number
  /**
   * ISO8601 timestamp when goal was completed
   */
  completedAt?: string
}
export namespace UpdateGoalDto {
  export enum type {
    MACRO = 'MACRO',
    MICRO = 'MICRO',
    OTHER = 'OTHER',
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
    OTHER = 'OTHER',
  }
}
