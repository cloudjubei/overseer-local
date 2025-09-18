/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConversationResponseDto } from '../models/ConversationResponseDto'
import type { HandleInputDto } from '../models/HandleInputDto'
import type { StartFlowDto } from '../models/StartFlowDto'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class ConversationsService {
  /**
   * Start a conversation flow
   * @returns ConversationResponseDto Returns the first prompt or immediate result
   * @throws ApiError
   */
  public static conversationsControllerStart({
    requestBody,
  }: {
    requestBody: StartFlowDto
  }): CancelablePromise<ConversationResponseDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/conversations/start',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Handle a user response for a conversation flow
   * @returns ConversationResponseDto Returns the next prompt or result
   * @throws ApiError
   */
  public static conversationsControllerHandle({
    requestBody,
  }: {
    requestBody: HandleInputDto
  }): CancelablePromise<ConversationResponseDto> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/conversations/handle',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
}
