/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GoalSuggestedModel = {
  type: GoalSuggestedModel.type
  category: GoalSuggestedModel.category
  difficulty: GoalSuggestedModel.difficulty
  text: string
  summary: string
}
export namespace GoalSuggestedModel {
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
