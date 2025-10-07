/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CheckInCreateModel = {
  /**
   * ISO8601 timestamp when the check-in starts
   */
  start: string
  frequency: CheckInCreateModel.frequency
  /**
   * Arbitrary metadata payload
   */
  metadata?: Record<string, any>
}
export namespace CheckInCreateModel {
  export enum frequency {
    DAILY = 'DAILY',
    WEEKLY = 'WEEKLY',
    BIWEEKLY = 'BIWEEKLY',
    MONTHLY = 'MONTHLY',
    OTHER = 'OTHER',
  }
}
