/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserMoodModel = {
  /**
   * Mood id (UUID)
   */
  id: string
  /**
   * Owner user id
   */
  userId: string
  /**
   * Related journal id if mood was extracted from a journal
   */
  journalId?: string
  /**
   * Overall mood score on 0..10 (0=very low, 10=very positive)
   */
  score: number
  /**
   * Short textual summary/label of the mood (e.g., calm, stressed, content)
   */
  text?: string
  /**
   * Source of the mood observation
   */
  source?: string
  /**
   * Optional tone-of-voice analysis when audio was provided
   */
  audioTone?: Record<string, any>
  /**
   * ISO8601 timestamp when the mood was recorded
   */
  createdAt: string
  /**
   * ISO8601 timestamp when the mood was last updated
   */
  updatedAt: string
}
