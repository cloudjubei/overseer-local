/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserAudioFileModel } from './UserAudioFileModel'
export type UserAudioFilesListModel = {
  /**
   * The list of user audio files.
   */
  items: Array<UserAudioFileModel>
  /**
   * The cursor to use to fetch the next page of results.
   */
  nextCursor?: string
}
