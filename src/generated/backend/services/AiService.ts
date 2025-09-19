/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LlmTestDto } from '../models/LlmTestDto'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class AiService {
  /**
   * Public LLM test endpoint. Sends raw text to the specified model and returns raw text.
   * @returns string Raw text response from the LLM
   * @throws ApiError
   */
  public static aiControllerTest({
    model,
    requestBody,
  }: {
    /**
     * Model/provider to use: openai | gemini | anthropic
     */
    model: 'openai' | 'gemini' | 'anthropic'
    requestBody: LlmTestDto
  }): CancelablePromise<string> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/ai/test',
      query: {
        model: model,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Missing/invalid model or API key not configured`,
      },
    })
  }
}
