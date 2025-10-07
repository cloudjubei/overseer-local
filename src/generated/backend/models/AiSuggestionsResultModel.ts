/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GoalSuggestedModel } from './GoalSuggestedModel'
import type { MoodAnalysisResultDto } from './MoodAnalysisResultDto'
export type AiSuggestionsResultModel = {
  suggestions: Array<GoalSuggestedModel>
  genericSuggestions: Array<GoalSuggestedModel>
  transcriptionConfidence?: number
  llmConfidence?: number
  combinedConfidence: number
  needsConfirmation: boolean
  understoodText?: string
  message?: string
  mood?: MoodAnalysisResultDto
}
