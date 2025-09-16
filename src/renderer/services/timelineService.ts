import type { TimelineLabel } from '../../types/timeline'
import type { Feature } from 'thefactory-db/dist/types' // Assuming Feature type is available from thefactory-db

export type TimelineService = {
  getCompletedFeaturesByProjectId: (projectId: string) => Promise<Feature[]>
  addTimelineLabel: (input: TimelineLabel) => Promise<TimelineLabel>
  getTimelineLabelById: (id: string) => Promise<TimelineLabel | undefined>
  updateTimelineLabel: (id: string, patch: Partial<TimelineLabel>) => Promise<TimelineLabel>
  deleteTimelineLabel: (id: string) => Promise<void>
  searchTimelineLabels: (params: any) => Promise<TimelineLabel[]>
  matchTimelineLabels: (criteria: any, options?: any) => Promise<TimelineLabel[]>
}

declare global {
  interface Window {
    timelineService: TimelineService
  }
}

// This consumes the API exposed by preload.js
export const timelineService: TimelineService = { ...window.timelineService }
