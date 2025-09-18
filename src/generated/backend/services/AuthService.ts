/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChangePasswordDto } from '../models/ChangePasswordDto'
import type { ConfirmForgotPasswordDto } from '../models/ConfirmForgotPasswordDto'
import type { ConfirmSignUpDto } from '../models/ConfirmSignUpDto'
import type { ForgotPasswordDto } from '../models/ForgotPasswordDto'
import type { LoginDto } from '../models/LoginDto'
import type { LoginResultDto } from '../models/LoginResultDto'
import type { RegisterDto } from '../models/RegisterDto'
import type { RegisterResultDto } from '../models/RegisterResultDto'
import type { ResendConfirmationDto } from '../models/ResendConfirmationDto'
import type { StatusDto } from '../models/StatusDto'
import type { TelegramLoginDto } from '../models/TelegramLoginDto'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class AuthService {
  /**
   * Register a new user (Cognito or other default strategy)
   * @returns RegisterResultDto
   * @throws ApiError
   */
  public static authControllerRegister({
    requestBody,
  }: {
    requestBody: RegisterDto
  }): CancelablePromise<RegisterResultDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/register',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Confirm user registration using a verification code
   * @returns StatusDto
   * @throws ApiError
   */
  public static authControllerConfirmSignUp({
    requestBody,
  }: {
    requestBody: ConfirmSignUpDto
  }): CancelablePromise<StatusDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/confirm-signup',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Login with username and password
   * @returns LoginResultDto
   * @throws ApiError
   */
  public static authControllerLogin({
    requestBody,
  }: {
    requestBody: LoginDto
  }): CancelablePromise<LoginResultDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/login',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Login via Telegram using externalId + accessCode + secret
   * @returns LoginResultDto
   * @throws ApiError
   */
  public static authControllerLoginTelegram({
    requestBody,
  }: {
    requestBody: TelegramLoginDto
  }): CancelablePromise<LoginResultDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/login/telegram',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Initiate forgot password flow
   * @returns StatusDto
   * @throws ApiError
   */
  public static authControllerForgotPassword({
    requestBody,
  }: {
    requestBody: ForgotPasswordDto
  }): CancelablePromise<StatusDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/forgot-password',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Complete password reset using confirmation code
   * @returns StatusDto
   * @throws ApiError
   */
  public static authControllerConfirmForgotPassword({
    requestBody,
  }: {
    requestBody: ConfirmForgotPasswordDto
  }): CancelablePromise<StatusDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/confirm-forgot-password',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Change password using current session access token
   * @returns StatusDto
   * @throws ApiError
   */
  public static authControllerChangePassword({
    requestBody,
  }: {
    requestBody: ChangePasswordDto
  }): CancelablePromise<StatusDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/change-password',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Resend confirmation code for signup verification
   * @returns StatusDto
   * @throws ApiError
   */
  public static authControllerResendConfirmation({
    requestBody,
  }: {
    requestBody: ResendConfirmationDto
  }): CancelablePromise<StatusDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/auth/resend-confirmation',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
}
