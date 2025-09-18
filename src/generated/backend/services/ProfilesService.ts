/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateProfileDto } from '../models/CreateProfileDto'
import type { UpdateProfileDto } from '../models/UpdateProfileDto'
import type { UserProfileDto } from '../models/UserProfileDto'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class ProfilesService {
  /**
   * Get the current user profile
   * @returns UserProfileDto
   * @throws ApiError
   */
  public static profilesControllerMe(): CancelablePromise<UserProfileDto> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/profiles/me',
    })
  }
  /**
   * Create the current user profile
   * @returns UserProfileDto
   * @throws ApiError
   */
  public static profilesControllerCreate({
    requestBody,
  }: {
    requestBody: CreateProfileDto
  }): CancelablePromise<UserProfileDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/profiles/me',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Update the current user profile
   * @returns UserProfileDto
   * @throws ApiError
   */
  public static profilesControllerUpdate({
    requestBody,
  }: {
    requestBody: UpdateProfileDto
  }): CancelablePromise<UserProfileDto> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/profiles/me',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
}
