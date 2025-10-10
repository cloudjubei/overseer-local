/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LifestyleModel } from '../models/LifestyleModel'
import type { UserProfileModel } from '../models/UserProfileModel'
import type { UserProfileUpdateModel } from '../models/UserProfileUpdateModel'
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
   * Update the current user profile
   * @returns UserProfileModel
   * @throws ApiError
   */
  public static profilesControllerUpdate({
    requestBody,
  }: {
    requestBody: UserProfileUpdateModel
  }): CancelablePromise<UserProfileModel> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/profiles/me',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Add a new lifestyle entry to the current user profile
   * @returns UserProfileModel
   * @throws ApiError
   */
  public static profilesControllerAddLifestyle({
    requestBody,
  }: {
    requestBody: LifestyleModel
  }): CancelablePromise<UserProfileModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/profiles/me/lifestyle',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
}
