/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConversationResponseModel } from '../models/ConversationResponseModel'
import type { HandleInputModel } from '../models/HandleInputModel'
import type { StartFlowModel } from '../models/StartFlowModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class ConversationsService {
  /**
   * Start a conversation flow
   * @returns ConversationResponseModel Returns the first prompt or immediate result
   * @throws ApiError
   */
  public static conversationsControllerStart({
    requestBody,
  }: {
    requestBody: StartFlowModel
  }): CancelablePromise<ConversationResponseModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/conversations/start',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
  /**
   * Handle a user response for a conversation flow
   * @returns ConversationResponseModel Returns the next prompt or result
   * @throws ApiError
   */
  public static conversationsControllerHandle({
    requestBody,
  }: {
    requestBody: HandleInputModel
  }): CancelablePromise<ConversationResponseModel> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/conversations/handle',
      body: requestBody,
      mediaType: 'application/json',
    })
  }
}
