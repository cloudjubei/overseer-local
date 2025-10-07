/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChangePasswordModel } from '../models/ChangePasswordModel'
import type { ConfirmForgotPasswordModel } from '../models/ConfirmForgotPasswordModel'
import type { ConfirmSignUpModel } from '../models/ConfirmSignUpModel'
import type { ForgotPasswordModel } from '../models/ForgotPasswordModel'
import type { LoginModel } from '../models/LoginModel'
import type { LoginResultModel } from '../models/LoginResultModel'
import type { RegisterModel } from '../models/RegisterModel'
import type { RegisterResultModel } from '../models/RegisterResultModel'
import type { ResendConfirmationModel } from '../models/ResendConfirmationModel'
import type { StatusModel } from '../models/StatusModel'
import type { TelegramLoginModel } from '../models/TelegramLoginModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class AuthService {
  /**
   * Register a new user (Cognito or other default strategy)
   * @returns RegisterResultModel
   * @throws ApiError
   */
  public static authControllerRegister({
    requestBody,
  }: {
    requestBody: RegisterModel
  }): CancelablePromise<RegisterResultModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/register',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Confirm user registration using a verification code
   * @returns StatusModel
   * @throws ApiError
   */
  public static authControllerConfirmSignUp({
    requestBody,
  }: {
    requestBody: ConfirmSignUpModel
  }): CancelablePromise<StatusModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/confirm-signup',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Login with username and password
   * @returns LoginResultModel
   * @throws ApiError
   */
  public static authControllerLogin({
    requestBody,
  }: {
    requestBody: LoginModel
  }): CancelablePromise<LoginResultModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/login',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Login via Telegram using externalId + accessCode + secret
   * @returns LoginResultModel
   * @throws ApiError
   */
  public static authControllerLoginTelegram({
    requestBody,
  }: {
    requestBody: TelegramLoginModel
  }): CancelablePromise<LoginResultModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/login/telegram',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Initiate forgot password flow
   * @returns StatusModel
   * @throws ApiError
   */
  public static authControllerForgotPassword({
    requestBody,
  }: {
    requestBody: ForgotPasswordModel
  }): CancelablePromise<StatusModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/forgot-password',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Complete password reset using confirmation code
   * @returns StatusModel
   * @throws ApiError
   */
  public static authControllerConfirmForgotPassword({
    requestBody,
  }: {
    requestBody: ConfirmForgotPasswordModel
  }): CancelablePromise<StatusModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/confirm-forgot-password',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Change password using current session access token
   * @returns StatusModel
   * @throws ApiError
   */
  public static authControllerChangePassword({
    requestBody,
  }: {
    requestBody: ChangePasswordModel
  }): CancelablePromise<StatusModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/change-password',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Resend confirmation code for signup verification
   * @returns StatusModel
   * @throws ApiError
   */
  public static authControllerResendConfirmation({
    requestBody,
  }: {
    requestBody: ResendConfirmationModel
  }): CancelablePromise<StatusModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/resend-confirmation',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
}
