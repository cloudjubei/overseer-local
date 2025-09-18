/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SuggestedGoalDto } from './SuggestedGoalDto';
export type AiSuggestionsResultDto = {
    suggestions: Array<SuggestedGoalDto>;
    transcriptionConfidence?: number;
    llmConfidence?: number;
    combinedConfidence: number;
    needsConfirmation: boolean;
    understoodText?: string;
    message?: string;
};

