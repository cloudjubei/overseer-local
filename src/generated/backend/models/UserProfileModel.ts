/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserProfileModel = {
  /**
   * User id
   */
  id: string
  /**
   * Name
   */
  name?: string
  /**
   * Date of birth (YYYY-MM-DD)
   */
  dob?: string
  gender?: UserProfileModel.gender
  /**
   * Weight in kilograms (normalized)
   */
  weight?: number
  /**
   * Original user-entered weight string
   */
  weight_raw?: string
  /**
   * Height in centimeters (normalized)
   */
  height?: number
  /**
   * Original user-entered height string
   */
  height_raw?: string
  /**
   * IANA timezone identifier
   */
  timezone: string
  /**
   * User-entered lifestyle levels
   */
  lifestyles: Array<string>
  /**
   * ISO8601 timestamp when record was created
   */
  createdAt: string
  /**
   * ISO8601 timestamp when record was last updated
   */
  updatedAt: string
}
export namespace UserProfileModel {
  export enum gender {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
    OTHER = 'OTHER',
  }
}
