/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateMacroGoalModel } from '../models/CreateMacroGoalModel'
import type { GoalModel } from '../models/GoalModel'
import type { GoalsListModel } from '../models/GoalsListModel'
import type { GoalSuggestedModel } from '../models/GoalSuggestedModel'
import type { GoalUpdateModel } from '../models/GoalUpdateModel'
import type { MicroGoalStateUpdateModel } from '../models/MicroGoalStateUpdateModel'
import type { StatusModel } from '../models/StatusModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class GoalsService {
  /**
   * Create a new macro goal from text
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerCreateMacroGoalFromText({
    requestBody,
  }: {
    requestBody: CreateMacroGoalModel
  }): CancelablePromise<GoalModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/goals/macro',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Create a new macro goal from an uploaded audio file
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerCreateMacroGoalFromAudio({
    formData,
  }: {
    formData: {
      file: Blob
    }
  }): CancelablePromise<GoalModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/goals/macro/audio',
      formData: formData,
      mediaType: 'multipart/form-data',
    })
  }
  /**
   * Generate up to 5 macro goal suggestions tailored to your profile
   * @returns GoalSuggestedModel
   * @throws ApiError
   */
  public static goalsControllerGenerateMacroGoalSuggestions(): CancelablePromise<
    Array<GoalSuggestedModel>
  > {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/goals/macro/suggestions',
    })
  }
  /**
   * Get the current active macro goal
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerGetCurrentMacroGoal(): CancelablePromise<GoalModel> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/goals/macro/current',
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
   * Update a micro goal's state. Automatically manages completedAt.
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerUpdateMicroGoalState({
    id,
    requestBody,
  }: {
    id: string
    requestBody: MicroGoalStateUpdateModel
  }): CancelablePromise<GoalModel> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/goals/micro/{id}/state',
      path: {
        id: id,
      },
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Generate 3 new micro goals for the current active macro goal
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerGenerateMicroGoals(): CancelablePromise<Array<GoalModel>> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/goals/generateMicroGoals',
    })
  }
  /**
   * List all micro goals for the current user
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerListMicroGoals(): CancelablePromise<Array<GoalModel>> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/goals/micro',
    })
  }
  /**
   * List micro goals filtered by state for the current user
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerListMicroGoalsByState({
    state,
  }: {
    state: 'ACTIVE' | 'CANCELLED' | 'FAIL' | 'SUCCESS'
  }): CancelablePromise<Array<GoalModel>> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/goals/micro/state/{state}',
      path: {
        state: state,
      },
    })
  }
  /**
   * List micro goals for a specific macro goal
   * @returns GoalModel
   * @throws ApiError
   */
  public static goalsControllerListMicroGoalsForMacro({
    id,
  }: {
    id: string
  }): CancelablePromise<Array<GoalModel>> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/goals/macro/{id}/micro',
      path: {
        id: id,
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
