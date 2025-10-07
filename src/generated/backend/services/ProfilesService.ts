/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ProfileCreateModel } from '../models/ProfileCreateModel'
import type { ProfileUpdateModel } from '../models/ProfileUpdateModel'
import type { UserProfileModel } from '../models/UserProfileModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class ProfilesService {
  /**
   * Get the current user profile
   * @returns UserProfileModel
   * @throws ApiError
   */
  public static profilesControllerMe(): CancelablePromise<UserProfileModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/profiles/me',
    })
  }
  /**
   * Create the current user profile
   * @returns UserProfileModel
   * @throws ApiError
   */
  public static profilesControllerCreate({
    requestBody,
  }: {
    requestBody: ProfileCreateModel
  }): CancelablePromise<UserProfileModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/profiles/me',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Update the current user profile
   * @returns UserProfileModel
   * @throws ApiError
   */
  public static profilesControllerUpdate({
    requestBody,
  }: {
    requestBody: ProfileUpdateModel
  }): CancelablePromise<UserProfileModel> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/profiles/me',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
}
