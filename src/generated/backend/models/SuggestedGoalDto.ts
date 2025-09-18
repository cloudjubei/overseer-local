/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SuggestedGoalDto = {
  type: SuggestedGoalDto.type
  category: SuggestedGoalDto.category
  difficulty: SuggestedGoalDto.difficulty
  text: string
}
export namespace SuggestedGoalDto {
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
