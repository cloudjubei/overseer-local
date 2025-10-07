/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GoalStepCreateTextModel } from '../models/GoalStepCreateTextModel'
import type { GoalStepModel } from '../models/GoalStepModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class GoalStepsService {
  /**
   * Create a goal step from text (links a journal entry)
   * @returns GoalStepModel
   * @throws ApiError
   */
  public static goalStepsControllerCreateText({
    requestBody,
  }: {
    requestBody: GoalStepCreateTextModel
  }): CancelablePromise<GoalStepModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/goal-steps/text',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Create a goal step from an audio file (multipart/form-data with file)
   * @returns GoalStepModel
   * @throws ApiError
   */
  public static goalStepsControllerCreateAudio({
    formData,
  }: {
    formData: {
      file: Blob
    }
  }): CancelablePromise<GoalStepModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/goal-steps/audio',
      formData: formData,
      mediaType: 'multipart/form-data',
    })
  }
}
