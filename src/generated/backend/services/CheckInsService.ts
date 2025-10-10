/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CheckInCreateModel } from '../models/CheckInCreateModel'
import type { CheckInModel } from '../models/CheckInModel'
import type { CheckInsListResultModel } from '../models/CheckInsListResultModel'
import type { CheckInUpdateModel } from '../models/CheckInUpdateModel'
import type { StatusModel } from '../models/StatusModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class CheckInsService {
  /**
   * List check-ins for the current user
   * @returns CheckInsListResultModel
   * @throws ApiError
   */
  public static checkInsControllerGetCheckIns({
    limit = 20,
    cursor,
  }: {
    limit?: number
    /**
     * Opaque pagination token
     */
    cursor?: string
  }): CancelablePromise<CheckInsListResultModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/check-ins',
      query: {
        limit: limit,
        cursor: cursor,
      },
    })
  }
  /**
   * Create a new check-in for the current user
   * @returns CheckInModel
   * @throws ApiError
   */
  public static checkInsControllerAddCheckIn({
    requestBody,
  }: {
    requestBody: CheckInCreateModel
  }): CancelablePromise<CheckInModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/check-ins',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Clear all check-ins for user
   * @returns void
   * @throws ApiError
   */
  public static checkInsControllerClearCheckIns(): CancelablePromise<void> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/check-ins/all',
    })
  }
  /**
   * Update a check-in by id
   * @returns CheckInModel
   * @throws ApiError
   */
  public static checkInsControllerUpdateCheckIn({
    id,
    requestBody,
  }: {
    id: string
    requestBody: CheckInUpdateModel
  }): CancelablePromise<CheckInModel> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/check-ins/{id}',
      path: {
        id: id,
      },
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Delete a check-in by id
   * @returns StatusModel
   * @throws ApiError
   */
  public static checkInsControllerDeleteCheckIn({
    id,
  }: {
    id: string
  }): CancelablePromise<StatusModel> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/check-ins/{id}',
      path: {
        id: id,
      },
    })
  }
}
