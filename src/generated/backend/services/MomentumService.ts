/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserMomentumModel } from '../models/UserMomentumModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class MomentumService {
  /**
   * Get user momentum data
   * @returns UserMomentumModel
   * @throws ApiError
   */
  public static momentumControllerGetMomentum(): CancelablePromise<UserMomentumModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/momentum',
    })
  }
}
