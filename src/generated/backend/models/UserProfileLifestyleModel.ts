/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserProfileLifestyleModel = {
  /**
   * 1-Low, 2-Moderate, 3-High
   */
  activeLevel: number
  /**
   * 1-Low, 2-Medium, 3-High
   */
  energyLevel: number
  /**
   * Motivation text for the day based on energy level and recent rotation
   */
  motivationText: string
  /**
   * Evening motivation text based on energy level and recent rotation
   */
  motivationTextEvening: string
}
