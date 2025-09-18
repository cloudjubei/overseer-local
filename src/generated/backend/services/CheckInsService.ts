/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CheckInDto } from '../models/CheckInDto'
import type { CreateCheckInDto } from '../models/CreateCheckInDto'
import type { ListCheckInsResultDto } from '../models/ListCheckInsResultDto'
import type { StatusDto } from '../models/StatusDto'
import type { UpdateCheckInDto } from '../models/UpdateCheckInDto'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class CheckInsService {
  /**
   * List check-ins for the current user
   * @returns ListCheckInsResultDto
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
  }): CancelablePromise<ListCheckInsResultDto> {
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
   * @returns CheckInDto
   * @throws ApiError
   */
  public static checkInsControllerAddCheckIn({
    requestBody,
  }: {
    requestBody: CreateCheckInDto
  }): CancelablePromise<CheckInDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/check-ins',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Update a check-in by id
   * @returns CheckInDto
   * @throws ApiError
   */
  public static checkInsControllerUpdateCheckIn({
    id,
    requestBody,
  }: {
    id: string
    requestBody: UpdateCheckInDto
  }): CancelablePromise<CheckInDto> {
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
   * @returns StatusDto
   * @throws ApiError
   */
  public static checkInsControllerDeleteCheckIn({
    id,
  }: {
    id: string
  }): CancelablePromise<StatusDto> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/check-ins/{id}',
      path: {
        id: id,
      },
    })
  }
}
