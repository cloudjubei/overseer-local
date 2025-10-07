/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GoalCreateModel = {
  type: GoalCreateModel.type
  category: GoalCreateModel.category
  difficulty: GoalCreateModel.difficulty
  text: string
}
export namespace GoalCreateModel {
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
