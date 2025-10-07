/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AiSuggestGoalsModel } from '../models/AiSuggestGoalsModel'
import type { AiSuggestionsResultModel } from '../models/AiSuggestionsResultModel'
import type { GoalCreateModel } from '../models/GoalCreateModel'
import type { GoalModel } from '../models/GoalModel'
import type { GoalsListModel } from '../models/GoalsListModel'
import type { GoalSuggestedModel } from '../models/GoalSuggestedModel'
import type { GoalUpdateModel } from '../models/GoalUpdateModel'
import type { StatusModel } from '../models/StatusModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class GoalsService {
  /**
   * Create a new goal
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerCreate({
    requestBody,
  }: {
    requestBody: GoalCreateModel
  }): CancelablePromise<GoalModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/goals',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * List goals for current user
   * @returns GoalsListModel
   * @throws ApiError
   */
  public static goalsControllerList({
    limit = 20,
    nextCursor,
  }: {
    limit?: number
    /**
     * The cursor to use to fetch the next page of results.
     */
    nextCursor?: string
  }): CancelablePromise<GoalsListModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/goals',
      query: {
        limit: limit,
        nextCursor: nextCursor,
      },
    })
  }
  /**
   * Mark the current active goal as done
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerMarkCurrentDone(): CancelablePromise<GoalModel> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/goals/current/done',
    })
  }
  /**
   * Get AI-generated goal suggestions from text
   * @returns AiSuggestionsResultModel
   * @throws ApiError
   */
  public static goalsControllerAiSuggestions({
    requestBody,
  }: {
    requestBody: AiSuggestGoalsModel
  }): CancelablePromise<AiSuggestionsResultModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/goals/ai/suggestions',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Get AI-generated goal suggestions from an uploaded audio file
   * @returns AiSuggestionsResultModel
   * @throws ApiError
   */
  public static goalsControllerAiSuggestionsFromAudio({
    formData,
  }: {
    formData: {
      file: Blob
    }
  }): CancelablePromise<AiSuggestionsResultModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/goals/ai/suggestions/audio',
      formData: formData,
      mediaType: 'multipart/form-data',
    })
  }
  /**
   * Get parameterized goal suggestions (non-AI)
   * @returns GoalSuggestedModel
   * @throws ApiError
   */
  public static goalsControllerParamSuggestions({
    type,
    category,
    difficulty,
  }: {
    type: 'MACRO' | 'MICRO'
    category: 'FITNESS' | 'SLEEP' | 'FOCUS' | 'STRESS' | 'OTHER'
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD'
  }): CancelablePromise<Array<GoalSuggestedModel>> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/goals/suggestions',
      query: {
        type: type,
        category: category,
        difficulty: difficulty,
      },
    })
  }
  /**
   * Get a goal by id
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerGet({ id }: { id: string }): CancelablePromise<GoalModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/goals/{id}',
      path: {
        id: id,
      },
    })
  }
  /**
   * Update a goal by id
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerUpdate({
    id,
    requestBody,
  }: {
    id: string
    requestBody: GoalUpdateModel
  }): CancelablePromise<GoalModel> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/goals/{id}',
      path: {
        id: id,
      },
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Delete a goal by id
   * @returns StatusModel
   * @throws ApiError
   */
  public static goalsControllerRemove({ id }: { id: string }): CancelablePromise<StatusModel> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/goals/{id}',
      path: {
        id: id,
      },
    })
  }
}
