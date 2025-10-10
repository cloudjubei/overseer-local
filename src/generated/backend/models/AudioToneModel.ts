/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AudioToneModel = {
  sentiment?: string
  intensity?: AudioToneModel.intensity
  /**
   * Confidence score 0..1
   */
  confidence?: number
  notes?: string
}
export namespace AudioToneModel {
  export enum intensity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
  }
}
