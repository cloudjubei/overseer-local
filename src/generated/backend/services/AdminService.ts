/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MoodsListResultModel } from '../models/MoodsListResultModel'
import type { UserActivityLogsListModel } from '../models/UserActivityLogsListModel'
import type { UserAudioFilesListModel } from '../models/UserAudioFilesListModel'
import type { UserConversationsListModel } from '../models/UserConversationsListModel'
import type { UserJournalsListModel } from '../models/UserJournalsListModel'
import type { UsersListModel } from '../models/UsersListModel'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class AdminService {
  /**
   * List all user profiles
   * @returns UsersListModel A paginated list of user profiles.
   * @throws ApiError
   */
  public static adminControllerListUserProfiles({
    nextCursor,
  }: {
    /**
     * The cursor to use to fetch the next page of results.
     */
    nextCursor?: string
  }): CancelablePromise<UsersListModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/admin/users',
      query: {
        nextCursor: nextCursor,
      },
    })
  }
  /**
   * List conversation logs for a specific user
   * @returns UserConversationsListModel A paginated list of conversation logs.
   * @throws ApiError
   */
  public static adminControllerListUserConversationLogs({
    userId,
    nextCursor,
  }: {
    userId: string
    /**
     * The cursor to use to fetch the next page of results.
     */
    nextCursor?: string
  }): CancelablePromise<UserConversationsListModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/admin/users/{userId}/conversations',
      path: {
        userId: userId,
      },
      query: {
        nextCursor: nextCursor,
      },
    })
  }
  /**
   * List activity logs for a specific user
   * @returns UserActivityLogsListModel A paginated list of activity logs.
   * @throws ApiError
   */
  public static adminControllerListUserActivityLogs({
    userId,
    nextCursor,
  }: {
    userId: string
    /**
     * The cursor to use to fetch the next page of results.
     */
    nextCursor?: string
  }): CancelablePromise<UserActivityLogsListModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/admin/users/{userId}/activity',
      path: {
        userId: userId,
      },
      query: {
        nextCursor: nextCursor,
      },
    })
  }
  /**
   * List moods for a specific user
   * @returns MoodsListResultModel A paginated list of moods.
   * @throws ApiError
   */
  public static adminControllerListUserMoods({
    userId,
    limit,
    nextCursor,
  }: {
    userId: string
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
      url: '/admin/users/{userId}/moods',
      path: {
        userId: userId,
      },
      query: {
        limit: limit,
        nextCursor: nextCursor,
      },
    })
  }
  /**
   * List journals for a specific user
   * @returns UserJournalsListModel A paginated list of journals.
   * @throws ApiError
   */
  public static adminControllerListUserJournals({
    userId,
    nextCursor,
  }: {
    userId: string
    /**
     * The cursor to use to fetch the next page of results.
     */
    nextCursor?: string
  }): CancelablePromise<UserJournalsListModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/admin/users/{userId}/journals',
      path: {
        userId: userId,
      },
      query: {
        nextCursor: nextCursor,
      },
    })
  }
  /**
   * List audio recordings for a specific user
   * @returns UserAudioFilesListModel A paginated list of audio file URLs.
   * @throws ApiError
   */
  public static adminControllerListUserAudioFiles({
    userId,
    nextCursor,
  }: {
    userId: string
    /**
     * The cursor to use to fetch the next page of results.
     */
    nextCursor?: string
  }): CancelablePromise<UserAudioFilesListModel> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/admin/users/{userId}/files/audio',
      path: {
        userId: userId,
      },
      query: {
        nextCursor: nextCursor,
      },
    })
  }
}
