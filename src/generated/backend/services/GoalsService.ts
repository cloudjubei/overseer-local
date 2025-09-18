/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AiSuggestGoalsDto } from '../models/AiSuggestGoalsDto';
import type { AiSuggestionsResultDto } from '../models/AiSuggestionsResultDto';
import type { CreateGoalDto } from '../models/CreateGoalDto';
import type { GoalDto } from '../models/GoalDto';
import type { ListGoalsResultDto } from '../models/ListGoalsResultDto';
import type { StatusDto } from '../models/StatusDto';
import type { SuggestedGoalDto } from '../models/SuggestedGoalDto';
import type { UpdateGoalDto } from '../models/UpdateGoalDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class GoalsService {
    /**
     * Create a new goal
     * @returns GoalDto
     * @throws ApiError
     */
    public static goalsControllerCreate({
        requestBody,
    }: {
        requestBody: CreateGoalDto,
    }): CancelablePromise<GoalDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/goals',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List goals for current user
     * @returns ListGoalsResultDto
     * @throws ApiError
     */
    public static goalsControllerList({
        limit = 20,
        cursor,
    }: {
        limit?: number,
        /**
         * Opaque pagination token
         */
        cursor?: string,
    }): CancelablePromise<ListGoalsResultDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/goals',
            query: {
                'limit': limit,
                'cursor': cursor,
            },
        });
    }
    /**
     * Get AI-generated goal suggestions from text
     * @returns AiSuggestionsResultDto
     * @throws ApiError
     */
    public static goalsControllerAiSuggestions({
        requestBody,
    }: {
        requestBody: AiSuggestGoalsDto,
    }): CancelablePromise<AiSuggestionsResultDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/goals/ai/suggestions',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get AI-generated goal suggestions from an uploaded audio file
     * @returns AiSuggestionsResultDto
     * @throws ApiError
     */
    public static goalsControllerAiSuggestionsFromAudio({
        formData,
    }: {
        formData: {
            file: Blob;
        },
    }): CancelablePromise<AiSuggestionsResultDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/goals/ai/suggestions/audio',
            formData: formData,
            mediaType: 'multipart/form-data',
        });
    }
    /**
     * Get parameterized goal suggestions (non-AI)
     * @returns SuggestedGoalDto
     * @throws ApiError
     */
    public static goalsControllerParamSuggestions({
        type,
        category,
        difficulty,
    }: {
        type: 'MACRO' | 'MICRO' | 'OTHER',
        category: 'FITNESS' | 'SLEEP' | 'FOCUS' | 'STRESS' | 'OTHER',
        difficulty?: 'EASY' | 'MEDIUM' | 'HARD' | 'OTHER',
    }): CancelablePromise<Array<SuggestedGoalDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/goals/suggestions',
            query: {
                'type': type,
                'category': category,
                'difficulty': difficulty,
            },
        });
    }
    /**
     * Get a goal by id
     * @returns GoalDto
     * @throws ApiError
     */
    public static goalsControllerGet({
        id,
    }: {
        id: string,
    }): CancelablePromise<GoalDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/goals/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Update a goal by id
     * @returns GoalDto
     * @throws ApiError
     */
    public static goalsControllerUpdate({
        id,
        requestBody,
    }: {
        id: string,
        requestBody: UpdateGoalDto,
    }): CancelablePromise<GoalDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/goals/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete a goal by id
     * @returns StatusDto
     * @throws ApiError
     */
    public static goalsControllerRemove({
        id,
    }: {
        id: string,
    }): CancelablePromise<StatusDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/goals/{id}',
            path: {
                'id': id,
            },
        });
    }
}
