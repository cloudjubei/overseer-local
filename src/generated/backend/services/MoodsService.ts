/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MoodsListResultModel } from '../models/MoodsListResultModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class MoodsService {
  /**
   * List your recorded moods
   * @returns MoodsListResultModel
   * @throws ApiError
   */
  public static moodsControllerList({
    limit,
    nextCursor,
  }: {
    /**
     * Max items to return (1..100)
     */
    limit?: number
    /**
     * The cursor to use to fetch the next page of results.
     */
    nextCursor?: string
  }): CancelablePromise<MoodsListResultModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/moods',
      query: {
        limit: limit,
        nextCursor: nextCursor,
      },
    })
  }
}
