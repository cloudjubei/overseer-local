/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MoodAnalysisResult } from './MoodAnalysisResult'
export type TranscriptionResultModel = {
  /**
   * Transcribed text
   */
  text: string
  /**
   * A user-facing summary of input text
   */
  confirmationText: string
  /**
   * STT confidence 0..1 (may be undefined when provider does not provide it)
   */
  confidence?: number
  /**
   * Raw provider response for debugging
   */
  raw?: Record<string, any>
  /**
   * Mood analysed from text
   */
  mood?: MoodAnalysisResult
}
