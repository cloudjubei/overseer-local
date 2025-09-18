/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateMoodDto } from './CreateMoodDto'
export type CreateGoalDto = {
  type: CreateGoalDto.type
  category: CreateGoalDto.category
  difficulty: CreateGoalDto.difficulty
  text: string
  moods?: Array<CreateMoodDto>
  rating?: number
}
export namespace CreateGoalDto {
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
