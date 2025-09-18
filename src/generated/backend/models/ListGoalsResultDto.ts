/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GoalDto } from './GoalDto';
export type ListGoalsResultDto = {
    items: Array<GoalDto>;
    /**
     * Cursor for fetching the next page
     */
    cursor?: string;
};

