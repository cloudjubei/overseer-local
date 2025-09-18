/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MessageDto } from '../models/MessageDto'
import type { StatusDto } from '../models/StatusDto'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class AppService {
  /**
   * Root endpoint
   * @returns MessageDto Hello message
   * @throws ApiError
   */
  public static appControllerGetHello(): CancelablePromise<MessageDto> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/',
    })
  }
  /**
   * Health check
   * @returns StatusDto Health status
   * @throws ApiError
   */
  public static appControllerHealth(): CancelablePromise<StatusDto> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/health',
    })
  }
}
