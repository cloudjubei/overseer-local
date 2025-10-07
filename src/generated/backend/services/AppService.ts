/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MessageModel } from '../models/MessageModel'
import type { StatusModel } from '../models/StatusModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class AppService {
  /**
   * Root endpoint
   * @returns MessageModel Hello message
   * @throws ApiError
   */
  public static appControllerGetHello(): CancelablePromise<MessageModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/',
    })
  }
  /**
   * Health check
   * @returns StatusModel Health status
   * @throws ApiError
   */
  public static appControllerHealth(): CancelablePromise<StatusModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/health',
    })
  }
}
