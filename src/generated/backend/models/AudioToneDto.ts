/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AudioToneDto = {
  sentiment?: string
  intensity?: AudioToneDto.intensity
  confidence?: number
  notes?: string
}
export namespace AudioToneDto {
  export enum intensity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
  }
}
