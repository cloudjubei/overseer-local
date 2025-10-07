/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type JournalModel = {
  id: string
  userId: string
  text: string
  source: JournalModel.source
  createdAt: string
  updatedAt: string
  audio?: Record<string, any>
  transcription?: Record<string, any>
}
export namespace JournalModel {
  export enum source {
    TEXT = 'text',
    AUDIO = 'audio',
  }
}
