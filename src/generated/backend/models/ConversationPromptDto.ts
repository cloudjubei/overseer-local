/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PromptFieldDto } from './PromptFieldDto';
import type { PromptOptionDto } from './PromptOptionDto';
export type ConversationPromptDto = {
    /**
     * Optional prompt title
     */
    title?: string;
    /**
     * Main message/instruction for the user
     */
    message: string;
    /**
     * Form-like input fields
     */
    fields: Array<PromptFieldDto>;
    /**
     * Menu-like options (e.g., buttons)
     */
    options?: Array<PromptOptionDto>;
    /**
     * Key name that the client should use to submit a selected option (defaults to "selection")
     */
    selectionName?: string;
    /**
     * Submit button label
     */
    submitLabel?: string;
};

