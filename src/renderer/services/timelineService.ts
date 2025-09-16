import type { TimelineLabel } from '../../types/timeline'

export type TimelineService = {
  addTimelineLabel: (input: TimelineLabel) => Promise<TimelineLabel>
  getTimelineLabelById: (id: string) => Promise<TimelineLabel | undefined>
  updateTimelineLabel: (id: string, patch: Partial<TimelineLabel>) => Promise<TimelineLabel>
  deleteTimelineLabel: (id: string) => Promise<void>
  searchTimelineLabels: (params: any) => Promise<TimelineLabel[]>
  matchTimelineLabels: (criteria: any, options?: any) => Promise<TimelineLabel[]>
}

export const timelineService: TimelineService = { ...window.timelineService }
