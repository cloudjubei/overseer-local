/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PromptFieldDto = {
  /**
   * Field name used as key in input payload
   */
  name: string
  /**
   * Human label to show to user
   */
  label: string
  /**
   * Type of field
   */
  type: PromptFieldDto.type
  /**
   * Whether this field is required
   */
  required?: boolean
}
export namespace PromptFieldDto {
  /**
   * Type of field
   */
  export enum type {
    TEXT = 'text',
    PASSWORD = 'password',
  }
}
