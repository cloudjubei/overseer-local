/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { JournalCreateTextModel } from '../models/JournalCreateTextModel'
import type { JournalModel } from '../models/JournalModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class JournalsService {
  /**
   * Create a text journal entry
   * @returns JournalModel
   * @throws ApiError
   */
  public static journalsControllerCreateText({
    requestBody,
  }: {
    requestBody: JournalCreateTextModel
  }): CancelablePromise<JournalModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/journals/text',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Create an audio journal entry (multipart/form-data with file)
   * @returns JournalModel
   * @throws ApiError
   */
  public static journalsControllerCreateAudio({
    formData,
  }: {
    formData: {
      file: Blob
    }
  }): CancelablePromise<JournalModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/journals/audio',
      formData: formData,
      mediaType: 'multipart/form-data',
    })
  }
}
