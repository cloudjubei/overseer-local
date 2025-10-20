/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TranscriptionResultModel } from './TranscriptionResultModel'
export type JournalModel = {
  id: string
  userId: string
  text: string
  source: JournalModel.source
  acknowledgmentText: string
  /**
   * A summary with concise bulletpoints of the input text
   */
  summaryBulletpoints: Array<string>
  createdAt: string
  updatedAt: string
  audio?: Record<string, any>
  transcription?: TranscriptionResultModel
}
export namespace JournalModel {
  export enum source {
    TEXT = 'text',
    AUDIO = 'audio',
  }
}
