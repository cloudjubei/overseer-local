/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GoalUpdateModel = {
  type?: GoalUpdateModel.type
  category?: GoalUpdateModel.category
  difficulty?: GoalUpdateModel.difficulty
  text?: string
  /**
   * ISO8601 timestamp when goal was completed
   */
  completedAt?: string
}
export namespace GoalUpdateModel {
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
