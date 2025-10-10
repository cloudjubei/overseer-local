/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConfirmForgotPasswordModel } from '../models/ConfirmForgotPasswordModel'
import type { ForgotPasswordModel } from '../models/ForgotPasswordModel'
import type { LoginModel } from '../models/LoginModel'
import type { LoginResultModel } from '../models/LoginResultModel'
import type { StatusModel } from '../models/StatusModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class AdminAuthService {
  /**
   * Admin login with username and password (Cognito Admin Pool)
   * @returns LoginResultModel
   * @throws ApiError
   */
  public static adminAuthControllerLogin({
    requestBody,
  }: {
    requestBody: LoginModel
  }): CancelablePromise<LoginResultModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/admin/auth/login',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Admin forgot password
   * @returns StatusModel
   * @throws ApiError
   */
  public static adminAuthControllerForgotPassword({
    requestBody,
  }: {
    requestBody: ForgotPasswordModel
  }): CancelablePromise<StatusModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/admin/auth/forgot-password',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Admin confirm forgot password
   * @returns StatusModel
   * @throws ApiError
   */
  public static adminAuthControllerConfirmForgotPassword({
    requestBody,
  }: {
    requestBody: ConfirmForgotPasswordModel
  }): CancelablePromise<StatusModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/admin/auth/confirm-forgot-password',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
}
